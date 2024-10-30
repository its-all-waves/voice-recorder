import React, { useRef, useReducer } from 'react'
import Peakmeter from 'web-audio-peakmeter-react'

import RecorderControls from './RecorderControls'

import './VoiceRecorder.css'

/** @typedef {import('./types').RecState} RecState */
/** @typedef {import('./types').AudioActionType} AudioActionType */

const audioCtx = new AudioContext()
const output = audioCtx.destination

const gainNode = audioCtx.createGain()
gainNode.gain.value = 0
gainNode.connect(output)

/** @type {MediaRecorder?} */
let recorder = null
let recordedChunks = []
let recInterval = null

/** 
 * @param {{ recState: RecState}} state 
 * @param {{ type: AudioActionType, data: Object }} action
 * */
function reducer(state, action) {
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
                micStreamSrcNode?.disconnect(gainNode)
                newState.micStreamSrcNode = null
                newState.meterInputSrcNode = null
                recorder = null
            } else {
                newState.micStreamSrcNode =
                    audioCtx.createMediaStreamSource(micStream)
                // -> gainNode -> audioCtx.destination
                newState.micStreamSrcNode.connect(gainNode)
                // use a separate audio stream source for the mic meter
                // so we can mute output and mic meter will still work
                // -> meter input -> meter
                newState.meterInputSrcNode =
                    audioCtx.createMediaStreamSource(micStream)
                // init recorder
                recorder = new MediaRecorder(
                    micStream, { mimeType: MIME_TYPES[audioFormat] }
                )
                recorder.ondataavailable = (event) => {
                    recordedChunks.push(event.data)
                }
                recorder.onstart = () => {
                    recordedChunks = []
                    recInterval = setInterval(() => {
                        dispatch({ type: 'REC_COUNTER_TICKED' })
                    }, 1000)
                }
                recorder.onresume = () => {
                    recInterval = setInterval(() => {
                        dispatch({ type: 'REC_COUNTER_TICKED' })
                    }, 1000)
                }
                recorder.onpause = () => clearInterval(recInterval)
                recorder.onstop = () => {
                    clearInterval(recInterval)
                    const blobUrl = URL.createObjectURL(new Blob(recordedChunks, { type: MIME_TYPES[data.audioFormat] }))
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
                    recorder.start(500)  // push to recordedChunks every 500ms
                    newState = { recState: 'RECORDING', recordDurationSec: 0 }
                    break
                case 'PAUSED':
                    recorder.resume()
                    newState = { recState: 'RECORDING' }
                    break
                case 'RECORDING':
                    recorder.pause()
                    newState = { recState: 'PAUSED' }
                    break
            }
            break
        case 'PRESSED_STOP':
            if (recState !== 'RECORDING' && recState !== 'PAUSED') break
            recorder.stop()
            newState = { recState: 'STOPPED' }
            break
        case 'TOGGLED_MONITOR':
            const MUTE_RAMP_SEC = 0.05
            const UNMUTE_RAMP_SEC = MUTE_RAMP_SEC
            if (gainNode.gain.value === 0) {
                gainNode.gain.linearRampToValueAtTime(
                    1, audioCtx.currentTime + UNMUTE_RAMP_SEC
                )
            } else {
                gainNode.gain.linearRampToValueAtTime(
                    0.00000001, audioCtx.currentTime + MUTE_RAMP_SEC
                )
                gainNode.gain.setValueAtTime(
                    0, audioCtx.currentTime + MUTE_RAMP_SEC + 0.01
                )
            }
            newState = { isMonitoring: !isMonitoring }
            break
    }
    const nextState = { ...state, ...newState }
    return nextState
}

// TODO: add support for mp3, etc...
// must use lib to do mp3 -- encode is not native to browser
const MIME_TYPES = {
    // 'mp3': 'audio/mpeg',
    'webm': 'audio/webm',
}

/** @typedef {import('./types').AudioTrackConstraints} AudioTrackConstraints */

/** @param {{ audioFormat: 'webm', audioConstraints: AudioTrackConstraints }} */
export default function VoiceRecorder({
    audioFormat = 'webm',
    audioConstraints = {
        autoGainControl: true,
        voiceIsolation: false,
        echoCancellation: false,
        noiseSuppression: false,
        channelCount: 1,
    }
}) {
    /** @type {[RecState, React.Dispatch<{ type: AudioActionType, data: Object }>]} */
    const [state, dispatch] = useReducer(reducer,
        {   // initial state
            recState: 'STOPPED',
            isMicOn: false,
            isMonitoring: false,
            micStreamSrcNode: null,
            meterInputSrcNode: null,
            recordDurationSec: 0,
        }
    )

    const {
        recState,
        isMicOn,
        isMonitoring,
        meterInputSrcNode,
        recordDurationSec,
    } = state
    const isRecording = recState === 'RECORDING'
    const isStopped = recState === 'STOPPED'

    /** @type {{ current: HTMLAudioElement? }} */
    const audioElem = useRef()

    return (
        <div
            style={{
                display: 'flex', flexDirection: 'column', gap: '1rem'
            }}
        >
            <h3
                style={{ margin: 0 }}
            >{isRecording ? 'Recording' : 'Stopped'}</h3>
            <div>
                {String(Math.floor(recordDurationSec / 60)).padStart(2, 0)}:{String(recordDurationSec % 60).padStart(2, 0)}
            </div>

            <RecorderControls
                recState={recState}
                isMicOn={isMicOn}
                isMonitoring={isMonitoring}
                onClickMic={async () => await toggleMicOn()}
                onClickMonitor={toggleMonitor}
                onClickRecord={toggleRecordPause}
                onClickStop={stopRecording}
            />

            <div
                id="meter-container"
                style={{
                    margin: '-5px',
                    outline: isRecording && '2px solid red',
                    animation: isRecording && 'pulsate ease-out 2s infinite'
                }}
            >
                {meterInputSrcNode &&  // render a working meter
                    <Peakmeter
                        audioCtx={audioCtx}
                        sourceNodes={[meterInputSrcNode]}
                        channels={1}
                    />
                    // NOTE: couldn't show an inactive meter without splitting
                    // this into two predicates
                }
                {!meterInputSrcNode &&  // render an inactive meter
                    <Peakmeter
                        audioCtx={audioCtx}
                        sourceNodes={[new ConstantSourceNode(audioCtx)]}
                        channels={1}
                    />}
            </div>

            <audio
                ref={audioElem}
                style={{
                    opacity: isStopped && recordedChunks.length ? 1 : 0,
                    transition: 'opacity 0.5s',
                }}
                src=""
                controls
            />
        </div>
    )

    async function toggleMicOn() {
        if (audioCtx.state === 'suspended') await audioCtx.resume()
        const micStream = isMicOn ? null : await getMicrophoneStream(audioConstraints)
        dispatch({
            type: "TOGGLED_MIC",
            data: {
                micStream,
                audioFormat,
                audioElem: audioElem.current,
                dispatch,
            }
        })
    }

    function toggleRecordPause() {
        dispatch({ type: "TOGGLED_RECORD_PAUSE" })
    }

    function stopRecording() {
        dispatch({ type: "PRESSED_STOP", data: { audioFormat } })
    }

    function toggleMonitor() {
        dispatch({ type: "TOGGLED_MONITOR" })
    }
}

async function getMicrophoneStream(audioConstraints) {
    /* ## AUDIO TRACK CONSTRAINTS (MEDIA TRACK CONSTRAINTS)
    https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints#instance_properties_of_audio_tracks */
    const constraints = { audio: audioConstraints, video: false }
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        const tracks = stream.getTracks()
        if (tracks.length !== 1) {
            throw new Error(`Expected 1 track. Captured ${tracks.length}`)
        }
        return stream
    } catch (error) {
        console.error(`Try removing constraints. Error: ${error}`)
    }
}