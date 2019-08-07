# ibtParse



## usage
```
	const parser = new IbtParser('myTelemetryFile.ibt')
	await parser.parse()

	const sessInfo = parser.getSessionInfo()

	// access session info
	const carSetup = sessInfo.CarSetup
	const numDrivers = sessInfo.WeekendInfo.MaxDrivers	// 14
	const eventType = sessInfo.WeekendInfo.EventType		// 'Race'


	// access var value
	const simFrameRate = parser.getVarValue('FrameRate')
```
