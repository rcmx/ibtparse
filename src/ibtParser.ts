import * as fs from 'fs';
import * as irSdk from './irSdk';
import * as datefns from 'date-fns';
import * as YAML from 'yamljs';


export class IbtParser {
	private fileName: string;
	private data: any;

	constructor(fileName: string) {
		this.fileName = fileName;
	}

	public async parse(): Promise<any> {
		const rawBuffer = await this.readFile();
		const sdkHeader = this.parseHeader(rawBuffer.buffer, 0);
		const diskSubHeader = this.parseDiskSubHeader(rawBuffer.buffer, irSdk.sizeof_irsdk_header);
		const sessionInfo = this.parseSessionInfo(rawBuffer.buffer, sdkHeader.sessionInfoOffset, sdkHeader.sessionInfoLen);

		const varHeaders = this.parseVarHeaders(rawBuffer.buffer, sdkHeader.varHeaderOffset, sdkHeader.numVars);

		// const vars = this.parseAllVars(fileData.buffer, varHeaders, latestVarBuf, sdkHeader.numVars);

		this.data = {
			rawBuffer,
			sdkHeader,
			diskSubHeader,
			sessionInfo,
			varHeaders
			// ,			vars
		};
	}

	public getVarValue(name: string): any {
		const latestVarBuf = this.data.sdkHeader.varBuf.reduce((latest: any, curr: any) => curr.tickCount > latest.tickCount ? curr : latest, this.data.sdkHeader.varBuf[0]);

		for (let i = 0; i < this.data.sdkHeader.numVars; i++) {
			if (this.data.varHeaders[i].name.toLowerCase() === name.toLowerCase()) {
				const varHeader = this.data.varHeaders[i];
				const varOffset = latestVarBuf.bufOffset + varHeader.offset;

				const varData = this.parseVar(this.data.rawBuffer.buffer, varOffset, varHeader.type);
				return varData;
			}
		}
		return -1;
	}

	// private getVarIdx(data: any, name:string): number {
	// 	for (let i = 0; i < data.sdkHeader.numVars; i++) {
	// 		if (data.varHeaders[i].name.toLowerCase() === name.toLowerCase()) {
	// 			return i;
	// 		}
	// 	}
	// 	return -1;
	// }

	// offset is the number of bytes from the start of the ArrayBuffer where this header starts
	private parseHeader(buff: ArrayBuffer, offset: number): irSdk.irsdk_header {
		// note: for the offset, we INCREMENT first, THEN read

		const header: any = {
			ver: this.getInt32(buff, offset + 0),
			status: this.getInt32(buff, offset + 4),
			tickRate: this.getInt32(buff, offset + 8),

			sessionInfoUpdate: this.getInt32(buff, offset + 12),
			sessionInfoLen: this.getInt32(buff, offset + 16),
			sessionInfoOffset: this.getInt32(buff, offset + 20),

			numVars: this.getInt32(buff, offset + 24),
			varHeaderOffset: this.getInt32(buff, offset + 28),

			numBuf: this.getInt32(buff, offset + 32),
			bufLen: this.getInt32(buff, offset + 36),
			pad1_0: 'pad' + (offset + 40),
			pad1_1: 'pad' + (offset + 44)
		};

		// create varBuff array and fill it in
		const varBuffOffset = offset + 48;

		header.varBuf = new Array<irSdk.irsdk_varBuf>(header.numBuf);
		for (let i = 0; i < header.numBuf; i++) {
			header.varBuf[i] = this.getVarBuf(buff, varBuffOffset + (i * irSdk.sizeOf_irsdk_varBuf));
		}

		return header;
	}

	// offset is the number of bytes from the start of the ArrayBuffer where this header starts
	private parseDiskSubHeader(buff: ArrayBuffer, offset: number): irSdk.irsdk_diskSubHeader {

		// time_t is 64bits and secs since epoc - convert to number, then ms and then Date
		const sessionStartDate = new Date(Number(this.getInt64(buff, offset + 0)) * 1000);

		const diskSubHeader: irSdk.irsdk_diskSubHeader = {
			sessionStartDate,
			sessionStartTime: datefns.addSeconds(sessionStartDate, Number(this.getDouble(buff, offset + 8))),
			sessionEndTime: datefns.addSeconds(sessionStartDate, Number(this.getDouble(buff, offset + 16))),
			sessionLapCount: this.getInt32(buff, offset + 24),
			sessionRecordCount: this.getInt32(buff, offset + 28)
		};
		return diskSubHeader;
	}

	private parseSessionInfo(buff: ArrayBuffer, offset: number, len: number): object {
		const yamlString = Buffer.from(buff, offset, len).toString();
		const sessInfo = YAML.parse(yamlString);

		return sessInfo;
	}

	private parseVarHeaders(buff: ArrayBuffer, offset: number, numVars: number): irSdk.irsdk_varHeader[] {
		const varHeaders: irSdk.irsdk_varHeader[] = [];

		for (let i = 0; i < numVars; i++) {
			const varHeader: any = {
				//				type: irSdk.irsdk_VarType[this.getInt(buff, offset += 0)],
				type: this.getInt32(buff, offset + 0) as irSdk.irsdk_VarType,
				offset: this.getInt32(buff, offset + 4),
				count: this.getInt32(buff, offset + 8),

				countAsTime: this.getBoolean(buff, offset + 12),
				pad: 'abc', 	// + (offset + 4),			// 3 bytes (16 byte align)

				name: this.getString(buff, (offset + 16), irSdk.IRSDK_MAX_STRING),
				desc: this.getString(buff, (offset + 16 + irSdk.IRSDK_MAX_STRING), irSdk.IRSDK_MAX_DESC),
				unit: this.getString(buff, (offset + 16 + irSdk.IRSDK_MAX_STRING + irSdk.IRSDK_MAX_DESC), irSdk.IRSDK_MAX_STRING)
			};
			varHeaders.push(varHeader);

			// bump offset to start of next varBuf
			offset += irSdk.sizeOf_irsdk_varHeader;
		}

		return varHeaders;
	}

	private parseAllVars(buff: ArrayBuffer, varHeaders: irSdk.irsdk_varHeader[], varBuf: irSdk.irsdk_varBuf, numVars: number): any {
		const vars: any[] = [];

		for (let i = 0; i < numVars; i++) {
			const varHeader = varHeaders[i];
			const varOffset = varBuf.bufOffset + varHeader.offset;

			const varData = this.parseVar(buff, varOffset, varHeader.type);
			vars.push(varData);

			// // debug
			// (varHeader as any).debugValue = varData;
			// console.log(`${i} - ${JSON.stringify(varHeader)}`);
		}

		return vars;
	}

	private parseVar(buff: ArrayBuffer, offset: number, type: irSdk.irsdk_VarType): any {
		let dataValue;

		switch (type) {
			case irSdk.irsdk_VarType.irsdk_char:			// 1 byte
				dataValue = this.getChar(buff, offset);
				break;
			case irSdk.irsdk_VarType.irsdk_bool:			// 1 byte
				dataValue = this.getBoolean(buff, offset);
				break;

			case irSdk.irsdk_VarType.irsdk_int:				// 4 bytes
				dataValue = this.getInt32(buff, offset);
				break;
			case irSdk.irsdk_VarType.irsdk_bitField:	// 4 bytes
				dataValue = this.getInt32(buff, offset);
				break;
			case irSdk.irsdk_VarType.irsdk_float:			// 4 bytes
				dataValue = this.getFloat(buff, offset);
				break;

			case irSdk.irsdk_VarType.irsdk_double:		// 8 bytes
				dataValue = this.getDouble(buff, offset);
				break;
			default:
				throw new Error(`unknown varHeader type: ${type}`);
		}

		return dataValue;
	}

	private getVarBuf(buff: ArrayBuffer, offset: number): irSdk.irsdk_varBuf {
		const varBuf = {
			tickCount: this.getInt32(buff, offset + 0),
			bufOffset: this.getInt32(buff, offset + 4),
			pad: 'abcd'	// (16 byte align)
		};

		return varBuf;
	}

	// countAsTime: this.getBooleanAsChar(buff, offset + 12),
	private getBoolean(buffer: ArrayBuffer, offset: number): boolean {
		const bool = this.getChar(buffer, offset) !== 0;
		return bool;
	}

	private getChar(buffer: ArrayBuffer, offset: number): number {
		const array = new Uint8Array(buffer, offset, 1);
		return array[0];
	}

	private getInt32(buffer: ArrayBuffer, offset: number): number {
		const dv = new DataView(buffer, offset, Int32Array.BYTES_PER_ELEMENT);
		const val = dv.getInt32(0, true);
		return val;
	}

	// private getBits32(buffer: ArrayBuffer, offset: number): Buffer {
	// 	const bytes = Buffer.from(buffer, offset, Uint32Array.BYTES_PER_ELEMENT);
	// 	return bytes;
	// 	// const dv = new DataView(buffer, offset, Uint8Array.BYTES_PER_ELEMENT);
	// 	// const val = dv.getInt32(0, true);
	// 	// return val;
	// }

	private getInt64(buffer: ArrayBuffer, offset: number): BigInt {
		const array = new BigInt64Array(buffer, offset, 1);
		return array[0];
	}

	private getFloat(buffer: ArrayBuffer, offset: number): number {
		const dv2 = new DataView(buffer, offset, Float32Array.BYTES_PER_ELEMENT);
		const val2 = dv2.getFloat32(0, true)
		return val2;
	}

	private getDouble(buffer: ArrayBuffer, offset: number): number {
		const dv = new DataView(buffer, offset, Float64Array.BYTES_PER_ELEMENT);
		const val = dv.getFloat64(0, true);
		return val;
	}

	private getString(buff: ArrayBuffer, offset: number, maxChars: number): string {
		const rawBytes = Buffer.from(buff, offset, maxChars);
		// find null terminator
		for (let i = 0; i < maxChars; i++) {
			if (rawBytes[i] === 0) {
				const str = rawBytes.slice(0, i).toString();
				return str;
			}
		}
		throw new Error('unable to find null terminator');
	}

	private async readFile(): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			fs.readFile(this.fileName, (err, data) => {
				if (err) {
					reject(err);
				}

				resolve(data);
			});
		});

	}
}


