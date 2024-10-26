import React, { useEffect, useRef, useState } from "react"
import Peakmeter from "web-audio-peakmeter-react"

import './HandRolledRecorder.css'

const audioCtx = new AudioContext()
const output = audioCtx.destination

// const MAX_GAIN = 0.9
// const gainNode = audioCtx.createGain()
// gainNode.connect(output)

// const oscNode = audioCtx.createOscillator()
// oscNode.type = "sine"
// oscNode.frequency.value = 440

// oscNode.connect(gainNode)
// gainNode.gain.value = 0
// oscNode.start()

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
    stopBtn: {
        animation: 'pulsate ease-out 2s infinite',
    }
}

export default function HandRolledRecorder() {

    const [isMuted, setIsMuted] = useState(true)

    /** @type {[audioStream: MediaStream, _]} */
    const [micStream, setMicStream] = useState(null)
    const [isMicrophoneOn, setIsMicrophoneOn] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
    const [micStreamSrcNode, setMicStreamSrcNode] = useState(null)
    const [meterInputSrcNode, setMeterInputSrcNode] = useState(null)
    const [recordedBlob, setRecordedBlob] = useState(null)

    /** @type {{ current: HTMLAudioElement | null }} */
    const audioElem = useRef()

    useEffect(() => {
        if (micStream) {
            // create 2 separate stream sources from the mic stream
            setMicStreamSrcNode(audioCtx.createMediaStreamSource(micStream))
            setMeterInputSrcNode(audioCtx.createMediaStreamSource(micStream))
            initRecorder(micStream)
        } else {
            setMicStreamSrcNode(null)
            setMeterInputSrcNode(null)
            recorder = null
        }
    }, [micStream])

    // DEBUG
    // useEffect(() => {
    //     console.log('mic track armed:', isMicTrackArmed)
    //     console.log('is recording:', isRecording)
    // }, [isMicTrackArmed, isRecording])

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
                    id="arm-mic-btn"
                    style={
                        { background: isMicrophoneOn ? 'green' : '' }
                    }
                    onClick={async () => await toggleMicOn()}
                >
                    Mic On
                </button>

                <button
                    id="record-stop-btn"
                    style={recordButtonStyle()}
                    disabled={!isMicrophoneOn}
                    onClick={async () => {
                        if (isRecording) {
                            // stop recording
                            recorder.stop()
                            // setIsMicrophoneOn(false)
                            setIsRecording(false)
                            return
                        }
                        // start recording
                        recorder.start()
                        setIsRecording(true)
                    }}
                >
                    {isRecording
                        ? 'Stop'
                        : 'Record'}
                </button>

                <button
                    id="mute-button"
                    disabled={!isMicrophoneOn}
                    onClick={() => {
                        if (!micStreamSrcNode) return
                        isMuted
                            ? micStreamSrcNode.connect(output)
                            : micStreamSrcNode.disconnect(output)
                        setIsMuted(!isMuted)
                    }}
                >
                    {isMuted ? 'Listen' : 'Mute'}
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
                    opacity: recordedBlob && !isRecording ? 1 : 0,
                    transition: 'opacity 0.5s',
                }}
                src=""
                controls
            />
        </div>
    )

    function recordButtonStyle() {
        let dynBtnStyle
        if (isRecording) {
            dynBtnStyle = styles.stopBtn
        } else if (isMicrophoneOn) {
            dynBtnStyle = styles.recordBtn
        }
        return { ...styles.mainBtn, ...dynBtnStyle }
    }

    async function toggleMicOn() {
        if (isMicrophoneOn) {
            // turn it off
            setMicStream(null)
            setIsMicrophoneOn(false)
            return
        }
        // turn it on
        if (audioCtx.state === "suspended") await audioCtx.resume()
        setMicStream(await getMicrophoneStream())
        setIsMicrophoneOn(true)
    }

    function initRecorder(stream) {
        recorder = new MediaRecorder(stream)
        recorder.ondataavailable = function (event) {
            recordedChunks.push(event.data)
        }
        recorder.onstop = function () {
            const blob = new Blob(recordedChunks, { type: 'audio/webm' })
            setRecordedBlob(blob)
            recordedChunks = []
            const blobUrl = URL.createObjectURL(blob)
            audioElem.current.src = blobUrl
            // automatically download the file
            const downloadLink = document.createElement('a')
            downloadLink.href = blobUrl
            downloadLink.download = 'recording.webm'
            downloadLink.click()
        }
    }

    function toggleMute() {
        const MUTE_RAMP_SEC = 0.05
        const UNMUTE_RAMP_SEC = MUTE_RAMP_SEC
        if (gainNode.gain.value === 0) {
            gainNode.gain.linearRampToValueAtTime(MAX_GAIN, audioCtx.currentTime + UNMUTE_RAMP_SEC)
        } else {
            gainNode.gain.linearRampToValueAtTime(0.00000001, audioCtx.currentTime + MUTE_RAMP_SEC)
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime + MUTE_RAMP_SEC + 0.01)
        }
    }
}

async function getMicrophoneStream() {
    const CONSTRAINTS = {
        audio: {
            autoGainControl: true,
            voiceIsolation: false,
            echoCancellation: false,
            noiseSuppression: false,
            channelCount: 1,
        },
        video: false,
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS)
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