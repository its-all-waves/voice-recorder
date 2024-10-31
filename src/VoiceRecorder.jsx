import React, { useRef, useReducer, useEffect } from 'react'
import Peakmeter from 'web-audio-peakmeter-react'
import './VoiceRecorder.css'

import { recManager } from './RecManager'

import RecorderControls from './RecorderControls'

/** @typedef {import('./types').RecState} RecState */
/** @typedef {import('./types').AudioActionType} AudioActionType */

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
                    recManager.recInterval = setInterval(() => {
                        dispatch({ type: 'REC_COUNTER_TICKED' })
                    }, 1000)
                }
                recManager.recorder.onresume = () => {
                    recManager.recInterval = setInterval(() => {
                        dispatch({ type: 'REC_COUNTER_TICKED' })
                    }, 1000)
                }
                recManager.recorder.onpause =
                    () => clearInterval(recManager.recInterval)
                recManager.recorder.onstop = () => {
                    clearInterval(recManager.recInterval)
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

    /** @type {{ recState: RecState, isMicOn: boolean, isMonitoring: boolean, meterInputSrcNode: MediaStreamAudioSourceNode, recordDurationSec: number }} */
    const {
        recState,
        isMicOn,
        isMonitoring,
        meterInputSrcNode,
        recordDurationSec,
    } = state
    const isRecording = recState === 'RECORDING'
    const isPaused = recState === 'PAUSED'
    const isStopped = recState === 'STOPPED'

    /** @type {{ current: HTMLAudioElement? }} */
    const audioElem = useRef()

    return (
        <div
            className="voice-recorder"
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
            <h3
                style={{
                    margin: 0,
                    animation: isRecording
                        ? 'pulsate-text ease-out 2s infinite'
                        : isPaused
                            ? 'pulsate-text steps(1, end) 1s infinite'
                            : '',
                }}
            >
                {isRecording
                    ? 'Recording'
                    : isPaused
                        ? 'Recording (Paused)'
                        : 'Stopped'}
            </h3>
            <div
                id="record-duration"
                style={{
                    fontSize: '1.15rem',
                    color: isRecording ? 'red' : '',
                    textShadow: isRecording ? '0 0.1rem 0 black' : '',
                    animation: isRecording
                        ? 'pulsate-text ease-out 2s infinite'
                        : isPaused
                            ? 'pulsate-text steps(1, end) 1s infinite'
                            : '',
                }}
            >
                {String(Math.floor(recordDurationSec / 60)).padStart(2, 0)}:
                {String(recordDurationSec % 60).padStart(2, 0)}
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
                style={{ margin: '-5px' }}
            >
                {meterInputSrcNode &&  // render a working meter
                    <Peakmeter
                        audioCtx={recManager.audioCtx}
                        sourceNodes={[meterInputSrcNode]}
                        channels={1}
                    />
                    // NOTE: couldn't show an inactive meter without splitting
                    // this into two predicates
                }
                {!meterInputSrcNode &&  // render an inactive meter
                    <Peakmeter
                        audioCtx={recManager.audioCtx}
                        sourceNodes={
                            [new ConstantSourceNode(recManager.audioCtx)]
                        }
                        channels={1}
                    />}
            </div>

            <audio
                ref={audioElem}
                style={{
                    opacity: isStopped && 
                        recManager.recordedChunks.length ? 1 : 0,
                    transition: 'opacity 0.5s',
                }}
                src=""
                controls
            />
        </div>
    )

    async function toggleMicOn() {
        if (recManager.audioCtx.state === 'suspended') {
            await recManager.audioCtx.resume()
        }
        const micStream = isMicOn 
            ? null 
            : await getMicrophoneStream(audioConstraints)
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