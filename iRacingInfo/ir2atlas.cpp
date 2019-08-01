
struct STSession
{
	STSession() :
		pFile(NULL),
		varHeaderOffset(0),
		varDataOffset(0),
		dfStartTime(0.0),
		dfEndTime(0.0),
		TimeSessionWasRecorded(0),
		nDetails(0),
		pDetails(NULL),
		nConstants(0),
		pConstants(NULL),
		pCurTimeData(NULL),
		pCurLapDistPctData(NULL),
		nLaps(0),
		nMaxLaps(0),
		pLaps(NULL),
		nMarkers(0),
		pMarkers(NULL),
		numCvtParams(0),
		nParams(0),
		pParams(NULL),
		nRecords(0),
		pFileName(NULL),
		pLineReader(NULL),
		sessionInfoStrLen(0),
		sessionInfoStr(NULL),
		ibtVarHeaderCount(0),
		ibtVarHeader(NULL)
	{
	}

	FILE* pFile;

	// offset into file for header and data
	LONG  varHeaderOffset;
	LONG  varDataOffset;

	// begin/end time for session
	//STSessionInfo_t sessionInfo;
	double dfStartTime;
	double dfEndTime;
	time_t TimeSessionWasRecorded;
	
	// driver name, track name, etc
	int nDetails;
	STSessionDetail_t* pDetails;

	// unused, session constants
	int nConstants;
	STSessionConstant_t* pConstants;
	
	// pointer to lap and time data
	const STParameterData *pCurTimeData;
	const STParameterData *pCurLapDistPctData;

	// lap start/end time and lap number
	int nLaps;
	int nMaxLaps;
	STLapInfo_t *pLaps;

	// unused, session markers
	int nMarkers;
	STMarkerInfo_t* pMarkers;

	static const int maxCvtParams = 10;
	STParamCvt cvtParams[maxCvtParams];
	int numCvtParams;

	// the core telemetry data 
	// number of parameters per data line, plus converted params tacked on the end
	int nParams;
	STParameterInfo_t *pParams;

	// number of data lines in file
	int nRecords;

	// name of file on disk
	char *pFileName;

	int sessionInfoStrLen;
	char *sessionInfoStr;

	// CSV data
	lineReader *pLineReader; // cached line reader

	// IBT data
	irsdk_header ibtHeader;
	irsdk_diskSubHeader ibtSubHeader;
	int ibtVarHeaderCount;
	irsdk_varHeader *ibtVarHeader;
};

void parseSessionDetails(STSession* pSession, bool detailsOnly)
{
	if(pSession)
	{
		parseIBTHeader(pSession, detailsOnly);

		if(!detailsOnly)
			parseIBTData(pSession);
	}
}

void parseIBTHeader(STSession *pSession, bool detailsOnly)
{
	int index;

	if(pSession && pSession->pFile)
	{
		fseek(pSession->pFile, 0, SEEK_SET);
		fread(&pSession->ibtHeader, sizeof(pSession->ibtHeader), 1, pSession->pFile);
		fread(&pSession->ibtSubHeader, sizeof(pSession->ibtSubHeader), 1, pSession->pFile);

		pSession->dfStartTime = pSession->ibtSubHeader.sessionStartTime * NUM_NANOSEC_IN_1_SEC;
		pSession->dfEndTime = pSession->ibtSubHeader.sessionEndTime * NUM_NANOSEC_IN_1_SEC;
		pSession->nLaps = pSession->ibtSubHeader.sessionLapCount;
		pSession->nRecords = pSession->ibtSubHeader.sessionRecordCount;
		pSession->TimeSessionWasRecorded = pSession->ibtSubHeader.sessionStartDate;

		pSession->sessionInfoStrLen = pSession->ibtHeader.sessionInfoLen;
		pSession->sessionInfoStr = new char[pSession->sessionInfoStrLen+1];
		if(pSession->sessionInfoStr)
		{
			fseek(pSession->pFile, pSession->ibtHeader.sessionInfoOffset, SEEK_SET);
			fread(pSession->sessionInfoStr, 1, pSession->sessionInfoStrLen, pSession->pFile);
			pSession->sessionInfoStr[pSession->sessionInfoStrLen] = '\0';
			parseSessionInfoString(pSession, false);
		}

		char tstr[512];
		tm tm_time;
		localtime_s(&tm_time, &pSession->ibtSubHeader.sessionStartDate);
		strftime(tstr, 512, " %Y-%m-%d %H:%M:%S", &tm_time);
		tstr[512-1] = '\0';
		appendSessionDetail(pSession, eDateRecorded, tstr, strlen(tstr));

		DebugPrint("dfStartTime %f", pSession->dfStartTime);
		DebugPrint("dfEndTime %f", pSession->dfEndTime);
		DebugPrint("nLaps %d", pSession->nLaps);
		DebugPrint("nRecords %d", pSession->nRecords);
		DebugPrint("TimeSessionWasRecorded %d", pSession->TimeSessionWasRecorded);
		DebugPrint("TimeSessionWasRecordedStr %s", tstr);

		if(!detailsOnly)
		{
			// lookup our type converter preference
			int conversionType = readRegKey(g_regPath, g_regKeyConversionType, g_DefaultConversionType);

			pSession->ibtVarHeaderCount = pSession->ibtHeader.numVars;
			if(pSession->ibtVarHeaderCount > 0)
			{
				pSession->ibtVarHeader = new irsdk_varHeader[pSession->ibtVarHeaderCount];
				if(pSession->ibtVarHeader)
				{
					fseek(pSession->pFile, pSession->ibtHeader.varHeaderOffset, SEEK_SET);
					fread(pSession->ibtVarHeader, sizeof(irsdk_varHeader), pSession->ibtVarHeaderCount, pSession->pFile);

					// unwind arrays into seperate variables
					// first count how many entrys there will be
					pSession->nParams = 0;
					int cvtParams = 0;
					for(index = 0; index<pSession->ibtVarHeaderCount; index++)
					{
						if(pSession->ibtVarHeader[index].type != irsdk_char)
							pSession->nParams += pSession->ibtVarHeader[index].count;
						else
							pSession->nParams++;

						// some channels need to be converted into units that ATLAS can understand
						// but we would like to keep the origional data as well
						if(cvtParams < pSession->maxCvtParams)
						{
							for(int i=0; i<cvtVarArrayCt; i++)
							{
								// we can not handle arrays or strings in the conversion
								if(0 == strcmp(cvtVarArray[i].srcName, pSession->ibtVarHeader[index].name))
								{
									if( (1 == pSession->ibtVarHeader[index].count) &&
										(pSession->ibtVarHeader[index].type != irsdk_char) )
									{
										DebugPrint(" found [%d]:%s", index, cvtVarArray[i].srcName);
										cvtParams++;
										// loop till we find something
										break;
									}
									else
										DebugPrint("warning, attempting to convert an array!, %d", index);
								}
							}
						}
					}
					pSession->nParams += cvtParams;

					pSession->pParams = new STParameterInfo_t[pSession->nParams];
					DebugPrint("pSession->nParams %d, cvtParams %d", pSession->nParams, cvtParams);

					STParameterInfo_t *pParam;
					irsdk_varHeader *pVarHeader;

					if(pSession->pParams)
					{
						int varIndex = 0;
						int varOffset = 0;
						int rParams = pSession->nParams - cvtParams;
						for(index = 0; index < rParams; index++)
						{
							pParam = &pSession->pParams[index];
							pParam->cbSize = sizeof( pSession->pParams[0] );

							pVarHeader = &pSession->ibtVarHeader[varIndex];
							int count = (pVarHeader->type == irsdk_char) ? 1 : pVarHeader->count;
							
							// handle to STParameterData
							pParam->hParam = (HANDLE*) new STParameterData();

							if(count > 1)
							{
								int len = strlen(pVarHeader->name);
								pParam->lpszName = new char[len + 10];
								pParam->lpszMnemonic = new char[len + 10];
								sprintf((char *)pParam->lpszName,"%s_%0*d", pVarHeader->name, (count>9) ? 2 : 1, varOffset);
								sprintf((char *)pParam->lpszMnemonic,"%s_%0*d", pVarHeader->name, (count>9) ? 2 : 1, varOffset);
							}
							else
							{
								pParam->lpszName = NewStrDup(pVarHeader->name);
								pParam->lpszMnemonic = NewStrDup(pVarHeader->name);
							}
							pParam->lpszDesc = NewStrDup(pVarHeader->desc);

							STParameterData *pData;
							pData = (STParameterData *)pParam->hParam;

							// do we have a parameter converter?
							pData->pCvtData = getCvtData(conversionType, pVarHeader->unit, pVarHeader->name);
							pParam->lpszUnits = NewStrDup(getCvtUnit(pData->pCvtData, pVarHeader->unit));

							pData->type = (irsdk_VarType)pVarHeader->type;

							pParam->lpszFormat = NewStrDup(g_pszDefaultFormat);
							pParam->lpszGroup = NewStrDup(g_pszDefaultGroup);
					
							pParam->dfStartTime = pSession->dfStartTime;
							pParam->dfEndTime = pSession->dfEndTime;

							// only check against first entrys in arrays (we should not be looking at arrays anyway).
							if(varOffset == 0)
							{
								// find the lap and time entrys, so we can calculate lap data
								if(0 == strcmp(g_varNameLapDistPct, pVarHeader->name))
								{
									pSession->pCurLapDistPctData = (STParameterData *)pParam->hParam;
									DebugPrint("Found LapDistPct: %d", index);
								}
								// assume entry 0 is session time, unless we find it
								else if(index == 0 || 0 == strcmp(g_varNameTime, pVarHeader->name))
								{
									pSession->pCurTimeData = (STParameterData *)pParam->hParam;
									DebugPrint("Found SessionTime: %d", index);
								}
							}

							// fill in our conversion index
							if(pSession->numCvtParams < pSession->maxCvtParams)
							{
								// destination
								STParameterInfo_t *pParamD;

								for(int i=0; i<cvtVarArrayCt; i++)
								{
									// we can not handle arrays or strings in the conversion
									if( (0 == strcmp(cvtVarArray[i].srcName, pVarHeader->name)) &&
										(1 == count) )
										// and assume type == float/double
									{
										// conversion matrix
										pSession->cvtParams[pSession->numCvtParams].srcIndex = index;
										pSession->cvtParams[pSession->numCvtParams].dstIndex = rParams + pSession->numCvtParams;
										pSession->cvtParams[pSession->numCvtParams].offset = cvtVarArray[i].offset;
										pSession->cvtParams[pSession->numCvtParams].scalar = cvtVarArray[i].scalar;

										// parameter we are copying from
										pParamD = &pSession->pParams[rParams + pSession->numCvtParams];

										// parameter we are filling in
										pParamD->cbSize = sizeof( pSession->pParams[0] );
	
										pParamD->lpszDesc = NewStrDup(pParam->lpszDesc);
										pParamD->lpszGroup = NewStrDup(pParam->lpszGroup);
										pParamD->lpszFormat = NewStrDup(pParam->lpszFormat);
										
										pParamD->dfStartTime = pParam->dfStartTime;
										pParamD->dfEndTime = pParam->dfEndTime;
										pParamD->dfSampleTime = pParam->dfSampleTime;

										pParamD->dfMinValue = pParam->dfMinValue;
										pParamD->dfMaxValue = pParam->dfMaxValue;

										pParamD->lpszName = NewStrDup(cvtVarArray[i].dstName);
										pParamD->lpszMnemonic = NewStrDup(cvtVarArray[i].dstName);
										pParamD->lpszUnits = NewStrDup(cvtVarArray[i].dstUnit);

										pParamD->hParam = (HANDLE*) new STParameterData();

										STParameterData *pData;
										pData = (STParameterData *)pParamD->hParam;
										pData->type = (irsdk_VarType)pVarHeader->type;
										pData->pCvtData = NULL; // make sure we don't convert the converted parametrs!

										//****RemoveMe
										/*
										DebugPrint(" setup [%d]:%s %s %s %s %s %s %s",
											pSession->numCvtParams,
											cvtVarArray[i].srcName,
											pParamD->lpszName,
											pParamD->lpszMnemonic,
											pParamD->lpszUnits,
											pParamD->lpszGroup,
											pParamD->lpszFormat,
											pParamD->lpszDesc );

										DebugPrint("  %d, %d, %f, %f, %d, %f, %f, %f, %f, %f, %d", 
											pSession->cvtParams[pSession->numCvtParams].srcIndex,
											pSession->cvtParams[pSession->numCvtParams].dstIndex,
											pSession->cvtParams[pSession->numCvtParams].offset,
											pSession->cvtParams[pSession->numCvtParams].scalar,
											pParamD->cbSize,
											pParamD->dfStartTime,
											pParamD->dfEndTime,
											pParamD->dfSampleTime,
											pParamD->dfMinValue,
											pParamD->dfMaxValue,
											pData->type );
										*/

										// increment
										pSession->numCvtParams++;

										// loop till we find something
										break;
									}
								}
							}

							//increment our index
							varOffset++;
							if(varOffset >= count)
							{
								varIndex++;
								varOffset = 0;
							}
						}
					}
				}
			}
		}
	}
}

void parseIBTData(STSession *pSession)
{
	STParameterData *pData;
	STParameterInfo_t *pParam;
	irsdk_varHeader *pVarHeader;
	int index;

	if(pSession && pSession->pFile)
	{
		fseek(pSession->pFile, pSession->ibtHeader.varBuf[0].bufOffset, SEEK_SET);

		//read all the data in
		double lastTime = pSession->dfStartTime;
		double lastLapDistPct = -1.0;

		// allocate our buffers
		for(index = 0; index < pSession->nParams; index++)
		{
			pParam = &pSession->pParams[index];
			pData = (STParameterData *)pParam->hParam;
			if(pData)
				pData->allocate(pSession->nRecords);
		}
		DebugPrint("pSession->nRecords %d", pSession->nRecords);

		char *dataLine = new char[pSession->ibtHeader.bufLen];
		if(dataLine)
		{
			int line;
			for(line=0; line < pSession->nRecords; line++)
			{
				if(pSession->ibtHeader.bufLen != (int)fread(dataLine, 1, pSession->ibtHeader.bufLen, pSession->pFile))
				{
					DebugPrint("Ran short on data at line %d of %d", line, pSession->nRecords);
					//****FixMe, make sure time and record counts updated properly
					break;
				}

				int varIndex = 0;
				int varOffset = 0;
				int rParams = pSession->nParams - pSession->numCvtParams;
				for(index = 0; index < rParams; index++)
				{
					pParam = &pSession->pParams[index];
					pData = (STParameterData *)pParam->hParam;

					pVarHeader = &pSession->ibtVarHeader[varIndex];
					int count = (pVarHeader->type == irsdk_char) ? 1 : pVarHeader->count;

					double value;
					switch(pVarHeader->type)
					{
					case irsdk_bool:
						value = (  (bool *)(dataLine+pVarHeader->offset))[varOffset]; break;
					case irsdk_int:
						value = (   (int *)(dataLine+pVarHeader->offset))[varOffset]; break;
					case irsdk_bitField:
						value = (   (int *)(dataLine+pVarHeader->offset))[varOffset]; break;
					case irsdk_float:
						value = ( (float *)(dataLine+pVarHeader->offset))[varOffset]; break;
					case irsdk_double:
						value = ((double *)(dataLine+pVarHeader->offset))[varOffset]; break;
					case irsdk_char:
					default:
						value = 0.0;
					}
					
					//if we are duplicating this channel, stash its value before we scale it.
					for(int i = 0; i < pSession->numCvtParams; i++)
					{
						if(index == pSession->cvtParams[i].srcIndex)
							pSession->cvtParams[i].value = value;
					}

					// convert the units on our value, if a conversion is provided that is
					value = getCvtValue(pData->pCvtData, value);

					//first time through?
					if(line == 0)
						pParam->dfMaxValue = pParam->dfMinValue = value;

					// grow min/max
					if(pParam->dfMinValue > value)
						pParam->dfMinValue = value;
					if(pParam->dfMaxValue < value)
						pParam->dfMaxValue = value;

					pData->set(line, value);

					//increment our index
					varOffset++;
					if(varOffset >= count)
					{
						varIndex++;
						varOffset = 0;
					}
				}

				// all parameters can be converted on the fly, but we also add in extra channels
				// now handle the aditional converted parameters
				for(index = 0; index < pSession->numCvtParams; index++)
				{
					STParameterData *pDstData;
					STParameterInfo_t *pDstParam;

					pDstParam = &pSession->pParams[pSession->cvtParams[index].dstIndex];
					pDstData = (STParameterData *)pDstParam->hParam;

					double value = pSession->cvtParams[index].value;
					value = (value + pSession->cvtParams[index].offset) * pSession->cvtParams[index].scalar; 
					pDstData->set(line, value);

					//first time through?
					if(line == 0)
						pDstParam->dfMaxValue = pDstParam->dfMinValue = value;

					// grow min/max
					if(pDstParam->dfMinValue > value)
						pDstParam->dfMinValue = value;
					if(pDstParam->dfMaxValue < value)
						pDstParam->dfMaxValue = value;
				}


				// figure out the current sample time
				// Note: first sample time is bogus...
				double currTime = pSession->pCurTimeData->getValue(line) * NUM_NANOSEC_IN_1_SEC;
				double sampleTime = currTime - lastTime;
				lastTime = currTime;
				// force it to 1/60th of a second, if invalid
				if(sampleTime < 1.0)
						sampleTime = NUM_NANOSEC_IN_1_SEC * 1.0 / 60.0;

				// and update the records
				for(index = 0; index < pSession->nParams; index++)
					pSession->pParams[index].dfSampleTime = sampleTime;

				// deal with laps, if avalible
				if(pSession->pCurLapDistPctData)
				{
					double currLapDistPct = pSession->pCurLapDistPctData->getValue(line);

					double DistPctScalar = 1.0;
					double minDistPct = 0.05;
					double maxDistPct = 0.95;
					// scale maxDist and minDist by scalar, if available
					if(pSession->pCurLapDistPctData->pCvtData)
					{
						DistPctScalar = pSession->pCurLapDistPctData->pCvtData->scalar;
						maxDistPct *= DistPctScalar;
						minDistPct *= DistPctScalar;
					}

					// if first line
					if(line == 0)
					{
						//reset lap counter
						pSession->nLaps = 0;

						// set the session start time
						pSession->dfStartTime = currTime;
						// and initialize the first lap
						pSession->pLaps[pSession->nLaps].dfStartTime = currTime;
						pSession->pLaps[pSession->nLaps].dwLapNumber = pSession->nLaps + 1;

						//if first entry, add in first lap!
						pSession->nLaps++;

						DebugPrint("start first lap: %f, %d, %f, %f", 
							pSession->pLaps[pSession->nLaps-1].dfStartTime, 
							pSession->pLaps[pSession->nLaps-1].dwLapNumber,
							lastLapDistPct,
							currLapDistPct );
					}
					else if(
						lastLapDistPct > maxDistPct && // if we passed the start finish line
						currLapDistPct < minDistPct && 
						//currLapDistPct > 0.0 && // 0.0 or -1.0 are invalid, even if not we will catch it on the next tick
						pSession->nLaps < pSession->nMaxLaps) // and we still have room in the lap table
					{
						DebugPrint("found lap crossing: %f, %f, %f, %f", 
							currTime,
							sampleTime,
							lastLapDistPct,
							currLapDistPct );

						// interpolate over the s/f line to get ms accuracy
						double sfPct = currLapDistPct / ((DistPctScalar + currLapDistPct) - lastLapDistPct);
						double intpTime = currTime - (sampleTime * sfPct);

						double duration = intpTime - pSession->pLaps[pSession->nLaps-1].dfStartTime;

						// only add the lap in if it is longer than 5 seconds in length.
						if(duration > minLapTime)
						{
							pSession->pLaps[pSession->nLaps-1].dfDuration = duration;
							pSession->pLaps[pSession->nLaps].dfStartTime = intpTime;
							pSession->pLaps[pSession->nLaps].dwLapNumber = pSession->nLaps + 1;
							pSession->nLaps++;

						DebugPrint("start next lap: %f, %d, %f, %f", 
							pSession->pLaps[pSession->nLaps-1].dfStartTime, 
							pSession->pLaps[pSession->nLaps-1].dwLapNumber,
							lastLapDistPct,
							currLapDistPct );
						}
					}
					lastLapDistPct = currLapDistPct;
				}
			}

			// adjust range
			for(index = 0; index < pSession->nParams; index++)
			{
				pParam = &pSession->pParams[index];
				pData = (STParameterData *)pParam->hParam;

				// if min == max
				if(pParam->dfMinValue == pParam->dfMaxValue)
				{
					//DebugPrint("Min == Max: %s, %f", pParam->lpszName, pParam->dfMinValue);

					pParam->dfMinValue = pParam->dfMinValue - 1.0;
					pParam->dfMaxValue = pParam->dfMaxValue + 1.0;
				}

				// if boolean or percent, scale from 0 to 1
				if(pData->type == irsdk_bool)
				{
					if(pParam->dfMinValue > 0.0)
						pParam->dfMinValue = 0.0;
					if(pParam->dfMaxValue < 1.0)
						pParam->dfMaxValue = 1.0;
				}
				if(0==strcmp(pParam->lpszUnits, "%"))
				{
					if(pParam->dfMinValue > 0.0)
						pParam->dfMinValue = 0.0;

					// percent can be scaled from 0-100% or just 0.0-1.0
					double max = 1.0f;
					if(pData->pCvtData)
						max = pData->pCvtData->scalar;
					if(pParam->dfMaxValue < max)
						pParam->dfMaxValue = max;
				}
			}

			// remember that line == pSession->nRecords
			double endTime = pSession->pCurTimeData->getValue(line-1);

			// grab actual end time
			if(endTime > 0.0)
			{
				pSession->dfEndTime = endTime * NUM_NANOSEC_IN_1_SEC;
			}

			// deal with laps, if avalible
			if(pSession->pCurLapDistPctData)
			{
				double duration = pSession->dfEndTime - pSession->pLaps[pSession->nLaps-1].dfStartTime;

				// finish filling in the last lap, if it is longer than 5 seconds in length.
				if(duration > minLapTime)
				{
					pSession->pLaps[pSession->nLaps-1].dfDuration = duration;

					DebugPrint("finish last lap: %f, %d, %f, %f", 
						pSession->pLaps[pSession->nLaps-1].dfStartTime, 
						pSession->pLaps[pSession->nLaps-1].dwLapNumber,
						pSession->pLaps[pSession->nLaps-1].dfDuration);
				}
				// otherwise remove it, it is too short to be valid
				// but don't remove the only lap
				else if(pSession->nLaps > 1) 
				{
					pSession->nLaps--;
					duration = pSession->dfEndTime - pSession->pLaps[pSession->nLaps-1].dfStartTime;
					pSession->pLaps[pSession->nLaps-1].dfDuration = duration;

					DebugPrint("remove last lap: %f, %d, %f, %f", 
						pSession->pLaps[pSession->nLaps-1].dfStartTime, 
						pSession->pLaps[pSession->nLaps-1].dwLapNumber,
						pSession->pLaps[pSession->nLaps-1].dfDuration);
				}

			}

			//mark how many lines we actualy found!
			if(line < pSession->nRecords)
			{
				DebugPrint("****Warning: Truncating nRecords from %d to %d", pSession->nRecords, line);
				pSession->nRecords = line;
			}

			// clean up local buffer
			if(dataLine)
			{
				delete [] dataLine;
				dataLine = NULL;
			}
		}
	}
}
