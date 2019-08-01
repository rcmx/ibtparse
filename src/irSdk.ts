export const IRSDK_MAX_BUFS = 4;
export const IRSDK_MAX_STRING = 32;
export const IRSDK_MAX_DESC = 64;

export enum irsdk_VarType {
	// 1 byte
	irsdk_char = 0,
	irsdk_bool,

	// 4 bytes
	irsdk_int,
	irsdk_bitField,
	irsdk_float,

	// 8 bytes
	irsdk_double,

	//index, don't use
	irsdk_ETCount
}


export interface irsdk_diskSubHeader {
	sessionStartDate: Date;	// time session was recorded. we'll convert this from C time_t and track as JS Date
	sessionStartTime: Date;
	sessionEndTime: Date;
	sessionLapCount: number;
	sessionRecordCount: number;
}
export const sizeOf_irsdk_diskSubHeader = 8 + 8 + 8 + 4 + 4;	// size of original C struct in bytes


export interface irsdk_varHeader {
	type: irsdk_VarType;	// irsdk_VarType
	offset: number;				// offset fron start of buffer row
	count: number;				// number of entrys (array) so length in bytes would be irsdk_VarTypeBytes[type] * count

	countAsTime: boolean;	// 1 byte
	pad: string;					// 3 bytes (16 byte align)

	name: string;					// IRSDK_MAX_STRING 32 bytes
	desc: string;					// IRSDK_MAX_DESC 64 bytes
	unit: string;					// IRSDK_MAX_STRING 32 bytes - something like "kg/m^2"
}
export const sizeOf_irsdk_varHeader = 4 + 4 + 4 + 1 + (1 * 3) + 32 + 64 + 32;	// size of original C struct in bytes


export interface irsdk_varBuf {
	tickCount: number;					// used to detect changes in data
	bufOffset: number;					// offset from header
	pad: string;			  				// (16 byte align)
}
export const sizeOf_irsdk_varBuf = 4 + 4 + (4 * 2);	// size of original C struct in bytes


export interface irsdk_header {
	ver: number;          			// this api header version, see IRSDK_VER
	status: number;							// bitfield using irsdk_StatusField
	tickRate: number;						// ticks per second (60 or 360 etc)

	// session information, updated periodicaly
	sessionInfoUpdate: number;	// Incremented when session info changes
	sessionInfoLen: number;			// Length in bytes of session info string
	sessionInfoOffset: number;	// Session info, encoded in YAML format

	// State data, output at tickRate
	numVars: number;						// length of arra pointed to by varHeaderOffset
	varHeaderOffset: number;		// offset to irsdk_varHeader[numVars] array, Describes the variables received in varBuf

	numBuf: number;							// <= IRSDK_MAX_BUFS (3 for now)
	bufLen: number;							// length in bytes for one line
	pad1: number;			    			// (16 byte align)
	varBuf: irsdk_varBuf[];     // buffers of data being written to
}
export const sizeof_irsdk_header = 4 * 10 + 4 * 2 + sizeOf_irsdk_varBuf * IRSDK_MAX_BUFS;	// size of original C struct in bytes


