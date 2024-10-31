import React, { useRef, useReducer, useEffect } from 'react'
import Peakmeter from 'web-audio-peakmeter-react'
import './VoiceRecorder.css'

import { recManager } from './RecManager'
import { reducer } from './voiceRecorderReducer'

import RecorderControls from './RecorderControls'

/** @typedef {import('./types').RecState} RecState */
/** @typedef {import('./types').AudioActionType} AudioActionType */
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