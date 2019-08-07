import { IbtParser } from '../lib/ibtParser'

describe('parse ibt', () => {
  const parser = new IbtParser('./tests/data/latemodel_southboston 2019-07-27 17-08-47.ibt')
  //const parser = new IbtParser('./test/data/mx5 cup_okayama full 2011-05-13 10-29-42.ibt');

  beforeAll(async () => {
    await parser.parse()
  })

  it('get SessionInfo', async () => {
    const sessInfo = parser.getSessionInfo()
    expect(sessInfo).toBeDefined()

    expect(sessInfo.CarSetup).toBeTruthy()
    expect(sessInfo.SessionInfo.Sessions.length).toEqual(3)
  })

  it('get FrameRate', async () => {
    const val = parser.getVarValue('FrameRate')
    expect(Math.round(val)).toEqual(40)
  })
})
