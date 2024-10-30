import React, { useEffect, useRef, useState, useReducer } from 'react'
import Peakmeter from 'web-audio-peakmeter-react'

import RecorderControls from './RecorderControls'

import './HandRolledRecorder.css'

const audioCtx = new AudioContext()
const output = audioCtx.destination

const gainNode = audioCtx.createGain()
gainNode.gain.value = 0
gainNode.connect(output)

/** @type {MediaRecorder?} */
let recorder = null
let recordedChunks = []
let recInterval = null

/** @type {Object<string, React.CSSProperties>} */
const styles = {
    mainBtn: {
    },
    armMicBtn: {
        background: 'green',
    },
    recordBtn: {
        background: 'darkred',
    },
    recBtnPaused: {
        animation: 'pulsate steps(1, end) 2s infinite',
    },
    stopBtn: {
        animation: 'pulsate ease-out 2s infinite',
    },
}

/** @typedef {'STOPPED' | 'RECORDING' | 'PAUSED'} RecState */

/** @typedef {'TOGGLED_MIC' | 'TOGGLED_RECORD' | 'PRESSED_STOP' | 'TOGGLED_MONITOR' | 'TOGGLED_MIC_STREAM' | 'REC_COUNTER_TICKED'} AudioActionType */

/** 
 * @param {{ recState: RecState}} state 
 * @param {{ type: AudioActionType, data: Object }} action
 * */
function reducer(state, action) {
    const {
        recState,
        isMicOn,
        isMonitoring,
        micStream,
        micStreamSrcNode,
        meterInputSrcNode,
        recordedBlob,
        recordDurationSec,
    } = state
    const { data } = action
    let newState = {}
    switch (action.type) {
        case 'TOGGLED_MIC':
            // due to async nature of task, must be in useEffect(...[isMicOn])
            newState = { isMicOn: !isMicOn }
            break
        case 'TOGGLED_MIC_STREAM':
            const { micStream, audioFormat, updateState } = data
            if (micStream) {
                newState.micStreamSrcNode =
                    audioCtx.createMediaStreamSource(micStream)
                newState.micStreamSrcNode.connect(gainNode)
                // because we want to control the meter input separately...
                newState.meterInputSrcNode =
                    audioCtx.createMediaStreamSource(micStream)
                // init recorder
                recorder = new MediaRecorder(micStream)
                recorder.ondataavailable = (event) => {
                    recordedChunks.push(event.data)
                }
                recorder.onstart = recorder.onresume = () => {
                    recInterval = setInterval(() => {
                        updateState({ type: 'REC_COUNTER_TICKED' })
                    }, 1000)
                }
                recorder.onpause = () => clearInterval(recInterval)
                recorder.onstop = () => clearInterval(recInterval)
            } else {
                newState.micStream = null
                micStreamSrcNode?.disconnect(gainNode)
                newState.micStreamSrcNode = null
                newState.meterInputSrcNode = null
                recorder = null
            }
            break
        case 'REC_COUNTER_TICKED':
            newState = { recordDurationSec: recordDurationSec + 1 }
            break
        case 'TOGGLED_RECORD':
            switch (recState) {
                case 'STOPPED':
                    recorder.start(500)  // save to recordedChunks every 500ms
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
            newState = {
                recState: 'STOPPED',
                recordedBlob: new Blob(
                    recordedChunks, { type: 'audio/' + data.audioFormat }
                )
            }
            recordedChunks = []
            break
        case 'TOGGLED_MONITOR':
            const MUTE_RAMP_SEC = 0.05
            const UNMUTE_RAMP_SEC = MUTE_RAMP_SEC
            newState = { isMonitoring: !isMonitoring }
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
            break
    }
    const nextState = { ...state, ...newState }
    return nextState

}




/** @param {{ format: 'mp3' | 'webm' }} */
export default function HandRolledRecorder({
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
    const [state, updateState] = useReducer(reducer,
        {   // initial state
            recState: 'STOPPED',
            isMicOn: false,
            isMonitoring: false,
            micStream: null,
            micStreamSrcNode: null,
            meterInputSrcNode: null,
            recordedBlob: null,
            recordDurationSec: 0,
        }
    )

    const {
        recState,
        isMicOn,
        isMonitoring,
        micStream,
        micStreamSrcNode,
        meterInputSrcNode,
        recordedBlob,
        recordDurationSec,
    } = state
    const isRecording = recState === 'RECORDING'
    const isPaused = recState === 'PAUSED'
    const isStopped = recState === 'STOPPED'

    /** @type {{ current: HTMLAudioElement? }} */
    const audioElem = useRef()

    // if mic is on, set mic stream, 
    // set mic + meter source nodes, 
    // init recorder,
    // else undo these
    useEffect(() => {
        (async () => {
            if (isMicOn) {
                // async code cannot run in reducer(), so do it here
                if (audioCtx.state === 'suspended') await audioCtx.resume()
                const micStream = await getMicrophoneStream(audioConstraints)
                updateState({
                    type: "TOGGLED_MIC_STREAM", data: {
                        micStream, audioFormat, updateState 
                    }
                })
            } else {
                updateState({
                    type: "TOGGLED_MIC_STREAM", data: { micStream: null }
                })
            }
        })()
    }, [isMicOn])

    // update audio elem and auto download recording when recording exists
    useEffect(() => {
        if (recordedBlob) {
            const blobUrl = URL.createObjectURL(recordedBlob)
            audioElem.current.src = blobUrl
            // automatically download recorded file on record stop
            let downloadLink = document.createElement('a')
            downloadLink.href = blobUrl
            downloadLink.download = 'recording.' + audioFormat
            downloadLink.click()
            downloadLink = undefined  // let GC clean up the link
        }
    }, [recordedBlob])


    useEffect(() => {
        console.log('record counter:', recordDurationSec)
    }, [recordDurationSec])

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
                onClickMic={toggleMicOn}
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
                    opacity: recordedBlob && isStopped ? 1 : 0,
                    transition: 'opacity 0.5s',
                }}
                src=""
                controls
            />
        </div>
    )

    async function toggleMicOn() {
        updateState({ type: 'TOGGLED_MIC' })
    }

    function toggleRecordPause() {
        updateState({ type: "TOGGLED_RECORD" })
    }

    function stopRecording() {
        updateState({ type: "PRESSED_STOP", data: { audioFormat } })
    }

    function toggleMonitor() {
        updateState({ type: "TOGGLED_MONITOR" })
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



