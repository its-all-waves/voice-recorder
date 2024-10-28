import React, { useEffect, useRef, useState, useReducer } from "react"
import Peakmeter from "web-audio-peakmeter-react"

import './HandRolledRecorder.css'

const audioCtx = new AudioContext()
const output = audioCtx.destination

const gainNode = audioCtx.createGain()
gainNode.gain.value = 0
gainNode.connect(output)

/** @type {MediaRecorder?} */
let recorder = null
let recordedChunks = []

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

const STATE = Object.freeze({
    RECORDING: 'Recording',
    PAUSED: 'Paused',
    STOPPED: 'Stopped',
    MUTED: 'Muted',
})

const ACTION = Object.freeze({
    TURN_ON_MIC: 'Mic On',
    PRESS_RECORD: 'Record',
    PRESS_PAUSE: 'Pause',
})

function reducer(state, action) {
    const { state: recState } = state
    let newState = {}
    switch (action.type) {
        case ACTION.PRESS_RECORD:
            // prevent loss of record stream while paused
            if (recState === STATE.PAUSED) return state
            toggleRecording()
            newState = {
                state: recState === STATE.STOPPED
                    ? STATE.RECORDING
                    : STATE.STOPPED
            }
            break
        case ACTION.PRESS_PAUSE:
            togglePause()
            newState = {
                state: recState === STATE.PAUSED
                    ? STATE.RECORDING
                    : STATE.PAUSED
            }
            break
    }
    return { ...state, ...newState }

    function toggleRecording() {
        if (recState === STATE.RECORDING) {
            recorder.stop()
            return
        }
        recorder.start()
    }

    function togglePause() {
        if (recState === STATE.PAUSED) {
            recorder.resume()
            return
        }
        recorder.pause()
    }
}


/** @param {{ format: 'mp3' | 'webm' }} */
export default function HandRolledRecorder({
    format = 'webm',
    audioConstraints = {
        autoGainControl: true,
        voiceIsolation: false,
        echoCancellation: false,
        noiseSuppression: false,
        channelCount: 1,
    }

}) {
    const [recState_, updateRecState] = useReducer(reducer, {
        state: STATE.STOPPED
    })

    /** @type {[MediaStream, _]} */
    const [micStream, setMicStream] = useState(null)
    /** @type {[MediaStreamAudioSourceNode, _]} */
    const [micStreamSrcNode, setMicStreamSrcNode] = useState(null)
    /** @type {[MediaStreamAudioSourceNode, _]} */
    const [meterInputSrcNode, setMeterInputSrcNode] = useState(null)

    const [recordedBlob, setRecordedBlob] = useState(null)

    // flags
    const [isMicrophoneOn, setIsMicrophoneOn] = useState(false)
    const [isMuted, setIsMuted] = useState(true)

    /** @type {{ current: HTMLAudioElement? }} */
    const audioElem = useRef()

    useEffect(() => {
        if (micStream) {
            // create 2 separate stream sources from the mic stream
            const micStreamNode = audioCtx.createMediaStreamSource(micStream)
            setMicStreamSrcNode(micStreamNode)
            micStreamNode.connect(gainNode)
            // because we want to control the meter input separately...
            setMeterInputSrcNode(audioCtx.createMediaStreamSource(micStream))
            initRecorder(micStream)
        } else {
            micStreamSrcNode?.disconnect(gainNode)
            setMicStreamSrcNode(null)
            setMeterInputSrcNode(null)
            recorder = null
        }
    }, [micStream])
    
    const { state: recState } = recState_
    const isRecording = recState === STATE.RECORDING
    const isPaused = recState === STATE.PAUSED
    const isStopped = recState === STATE.STOPPED

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
                <button
                    id="mic-on-btn"
                    disabled={isRecording || isPaused}
                    style={
                        { background: isMicrophoneOn ? 'green' : '' }
                    }
                    onClick={async () => {
                        if (isRecording || isPaused) return
                        await toggleMicOn()
                    }}
                >
                    Mic On
                </button>

                <div style={{ display: 'inline-block' }}>
                    <button
                        id="record-btn"
                        style={recordButtonStyle()}
                        disabled={!isMicrophoneOn}
                        onClick={(event) => {
                            event.target.blur()  // prevent accidental stop 
                            updateRecState({
                                type: ACTION.PRESS_RECORD,
                            })
                        }}
                    >
                        {isPaused
                            ? 'Paused'
                            : isRecording
                                ? 'Stop'
                                : 'Record'}
                    </button>

                    {(isRecording || isPaused) &&
                        <button
                            id="pause-btn"
                            onClick={() => {
                                updateRecState({
                                    type: ACTION.PRESS_PAUSE,
                                })
                            }}
                        >
                            {isPaused ? 'Resume' : 'Pause'}
                        </button>}
                </div>

                <button
                    id="mute-btn"
                    disabled={!isMicrophoneOn}
                    onClick={() => {
                        if (!micStreamSrcNode) return
                        toggleMute()
                    }}
                >
                    {isMuted ? 'Monitor Mic' : 'Mute Mic'}
                </button>
            </div>

            <div
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

    function recordButtonStyle() {
        let dynBtnStyle = {}
        if (isPaused) {
            dynBtnStyle = styles.recBtnPaused
        } else if (isRecording) {
            dynBtnStyle = styles.stopBtn
        } else if (isMicrophoneOn) {
            dynBtnStyle = styles.recordBtn
        }
        return { ...styles.mainBtn, ...dynBtnStyle }
    }

    function initRecorder(stream) {
        recorder = new MediaRecorder(stream)
        recorder.ondataavailable = function (event) {
            recordedChunks.push(event.data)
        }
        recorder.onstop = function () {
            const blob = new Blob(recordedChunks, { type: 'audio/' + format })
            setRecordedBlob(blob)
            recordedChunks = []
            const blobUrl = URL.createObjectURL(blob)
            audioElem.current.src = blobUrl
            // automatically download the file
            const downloadLink = document.createElement('a')
            downloadLink.href = blobUrl
            downloadLink.download = 'recording.' + format
            downloadLink.click()
        }
    }

    async function toggleMicOn() {
        setIsMicrophoneOn(!isMicrophoneOn)
        if (isMicrophoneOn) {
            // turn it off
            setMicStream(null)
            return
        }
        // turn it on
        if (audioCtx.state === "suspended") await audioCtx.resume()
        setMicStream(await getMicrophoneStream(audioConstraints))
    }

    function toggleMute() {
        const MUTE_RAMP_SEC = 0.05
        const UNMUTE_RAMP_SEC = MUTE_RAMP_SEC
        setIsMuted(!isMuted)
        if (gainNode.gain.value === 0) {
            gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + UNMUTE_RAMP_SEC)
            return
        }
        gainNode.gain.linearRampToValueAtTime(0.00000001, audioCtx.currentTime + MUTE_RAMP_SEC)
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime + MUTE_RAMP_SEC + 0.01)
    }
}

async function getMicrophoneStream(audioConstraints) {
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



/* 

## AUDIO TRACK CONSTRAINTS (MEDIA TRACK CONSTRAINTS)
https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints#instance_properties_of_audio_tracks


*/