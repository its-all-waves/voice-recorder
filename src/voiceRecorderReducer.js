import { recManager } from "./RecManager"

/** @typedef {import('./types').RecState} RecState */
/** @typedef {import('./types').AudioActionType} AudioActionType */

// TODO: add support for mp3, etc...
// must use lib to do mp3 -- encode is not native to browser
export const MIME_TYPES = {
    // 'mp3': 'audio/mpeg',
    'webm': 'audio/webm',
}

/** 
 * @param {{ recState: RecState}} state 
 * @param {{ type: AudioActionType, data: Object }} action
 * */
export function reducer(state, action) {
    const {
        recState,
        isMicOn,
        isMonitoring,
        micStreamSrcNode,
        recordDurationSec,
    } = state
    const { data } = action
    let newState = {}
    switch (action.type) {
        case 'TOGGLED_MIC':
            const { micStream, audioFormat, dispatch, audioElem } = data
            if (isMicOn) {
                micStreamSrcNode?.disconnect(recManager.gainNode)
                newState.micStreamSrcNode = null
                newState.meterInputSrcNode = null
                recManager.recorder = null
            } else {
                newState.micStreamSrcNode =
                    recManager.audioCtx.createMediaStreamSource(micStream)
                // -> gainNode -> audioCtx.destination
                newState.micStreamSrcNode.connect(recManager.gainNode)
                // use a separate audio stream source for the mic meter
                // so we can mute output and mic meter will still work
                // -> meter input -> meter
                newState.meterInputSrcNode =
                    recManager.audioCtx.createMediaStreamSource(micStream)
                // init recorder
                recManager.recorder = new MediaRecorder(
                    micStream, { mimeType: MIME_TYPES[audioFormat] }
                )
                recManager.recorder.ondataavailable = (event) => {
                    recManager.recordedChunks.push(event.data)
                }
                recManager.recorder.onstart = () => {
                    recManager.recordedChunks = []
                    recManager.recCounterInterval = setInterval(() => {
                        dispatch({ type: 'REC_COUNTER_TICKED' })
                    }, 1000)
                }
                recManager.recorder.onresume = () => {
                    recManager.recCounterInterval = setInterval(() => {
                        dispatch({ type: 'REC_COUNTER_TICKED' })
                    }, 1000)
                }
                recManager.recorder.onpause =
                    () => clearInterval(recManager.recCounterInterval)
                recManager.recorder.onstop = () => {
                    clearInterval(recManager.recCounterInterval)
                    const blobUrl = URL.createObjectURL(
                        new Blob(
                            recManager.recordedChunks,
                            { type: MIME_TYPES[data.audioFormat] }
                        )
                    )
                    audioElem.src = blobUrl
                    // automatically download recorded file on record stop
                    let downloadLink = document.createElement('a')
                    downloadLink.href = blobUrl
                    downloadLink.download = 'recording.' + audioFormat
                    downloadLink.click()
                    downloadLink = undefined  // let GC clean up the link
                }
            }
            newState.isMicOn = !isMicOn
            break
        case 'REC_COUNTER_TICKED':
            newState = { recordDurationSec: recordDurationSec + 1 }
            break
        case 'TOGGLED_RECORD_PAUSE':
            switch (recState) {
                case 'STOPPED':
                    // push to recordedChunks every 500ms
                    recManager.recorder.start(500)
                    newState = { recState: 'RECORDING', recordDurationSec: 0 }
                    break
                case 'PAUSED':
                    recManager.recorder.resume()
                    newState = { recState: 'RECORDING' }
                    break
                case 'RECORDING':
                    recManager.recorder.pause()
                    newState = { recState: 'PAUSED' }
                    break
            }
            break
        case 'PRESSED_STOP':
            if (recState !== 'RECORDING' && recState !== 'PAUSED') break
            recManager.recorder.stop()
            newState = { recState: 'STOPPED' }
            break
        case 'TOGGLED_MONITOR':
            const MUTE_RAMP_SEC = 0.05
            const UNMUTE_RAMP_SEC = MUTE_RAMP_SEC
            if (recManager.gainNode.gain.value === 0) {
                recManager.gainNode.gain.linearRampToValueAtTime(
                    1, recManager.audioCtx.currentTime + UNMUTE_RAMP_SEC
                )
            } else {
                recManager.gainNode.gain.linearRampToValueAtTime(
                    0.00000001, recManager.audioCtx.currentTime + MUTE_RAMP_SEC
                )
                recManager.gainNode.gain.setValueAtTime(
                    0, recManager.audioCtx.currentTime + MUTE_RAMP_SEC + 0.01
                )
            }
            newState = { isMonitoring: !isMonitoring }
            break
    }
    return { ...state, ...newState }
}