/* 
https://rpy.xyz/posts/20190119/web-audio-meters.html
*/

import { useEffect } from "react"
import { useState } from "react"
import { useRef } from "react"
import { useReactMediaRecorder } from "react-media-recorder"
import { WebAudioPeakMeter } from "web-audio-peak-meter"

import micImg from './assets/mic.white.svg'
import stopImg from './assets/stop.white.svg'

const confirmModalStyles = {
    position: 'fixed',
    inset: 0,
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 500,
    background: 'rgba(0, 0, 0, 0.8)',
}


export default function ReactMediaRecorderExample() {
    const {
        status: recorderStatus,
        startRecording,
        stopRecording,
        mediaBlobUrl,
        pauseRecording,
        resumeRecording,
        muteAudio,
        unmuteAudio,
        isMuted,
        clearBlobUrl,
        previewAudioStream,
    } = useReactMediaRecorder({ 
        video: false, 
        onStart: () => muteMonitorAudio(previewAudioStream),
        onStop: () => unMuteMonitorAudio(previewAudioStream),
    })

    const [$showStopConfirm, setShowConfirmStop] = useState(false)

    const meterElem = useRef()

    const confirmStopCheckbox = useRef()
    const [confirmStopCheckboxVal, setConfirmStopCheckboxVal] = useState(false)

    let audioCtx = null
    let peakMeter = typeof sourceNode !== 'undefined' && meterElem.current
        ? new WebAudioPeakMeter(sourceNode, meterElem.current)
        : null
    // useEffect(() => {
    //     if (!meterElem.current) return
    //     if (!previewAudioStream) return

    //     audioCtx = new AudioContext()
    //     const sourceNode = audioCtx.createMediaStreamSource(previewAudioStream)
    //     sourceNode.connect(audioCtx.destination)
    //     peakMeter = new WebAudioPeakMeter(sourceNode, meterElem.current)

    //     return () => peakMeter.cleanup()
    // }, [previewAudioStream])

    useEffect(() => {
        if (!meterElem.current || !previewAudioStream) return

        let audioCtx = null
        let peakMeter = null

        async function initializeAudio() {
            try {
                // Initialize the AudioContext
                audioCtx = new AudioContext()

                // Wait for the AudioContext to be resumed
                if (audioCtx.state === 'suspended') {
                    await audioCtx.resume()
                }

                // Ensure the previewAudioStream is valid
                if (!previewAudioStream) {
                    console.error('No valid media stream.')
                    return
                }

                // Create MediaStreamSource and connect it
                const sourceNode = audioCtx.createMediaStreamSource(previewAudioStream)
                sourceNode.connect(audioCtx.destination)

                // Initialize WebAudioPeakMeter
                peakMeter = new WebAudioPeakMeter(sourceNode, meterElem.current)
            } catch (error) {
                console.error("Failed to initialize peak meter:", error)
            }
        }

        // Start initialization after stream becomes available
        if (recorderStatus === 'recording' && previewAudioStream) {
            initializeAudio()
        }

        // Cleanup
        return () => {
            if (peakMeter) {
                peakMeter.cleanup()
            }
            if (audioCtx && audioCtx.state !== 'closed') {
                audioCtx.close()
            }
        }
    }, [recorderStatus, previewAudioStream])

    return (<>
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
        }}>
            <p>{recorderStatus}</p>
            <button
                style={{ background: 'none' }}
                onClick={() => {
                    switch (recorderStatus) {
                        case 'idle':  // fall thru
                        case 'stopped':
                            startRecording()
                        case 'paused':
                            // TODO
                            break
                        case 'recording':
                            setShowConfirmStop(true)
                            break
                    }
                }}
            >
                <img
                    src={recorderStatus === 'idle'
                        || recorderStatus === 'stopped'
                        ? micImg
                        : stopImg}
                    width="50px"
                    alt=""
                />
            </button>
            <audio
                src={mediaBlobUrl}
                controls
                onPlay={() => audioCtx?.resume() /* allows audio playback in Chrome */}
            />
        </div>

        <hr />

        <div>
            <div
                ref={meterElem}
                id="peak-meter"
                style={{ height: '80px' }}
            />
        </div>

        {$showStopConfirm &&
            <div style={confirmModalStyles}>
                <p>Are you sure you want to stop recording?</p>
                <label>
                    Yes, I'm sure I want to stop.
                    <input
                        ref={confirmStopCheckbox}
                        onChange={(e) => setConfirmStopCheckboxVal(e.target.checked)}
                        type="checkbox"
                        name="confirm-stop"
                        id="confirm-stop"
                    />
                </label>
                {confirmStopCheckboxVal &&
                    <button
                        type="button"
                        onClick={() => {
                            stopRecording()
                            setShowConfirmStop(false)
                            setConfirmStopCheckboxVal(false)
                        }}
                    >
                        Stop
                    </button>}
                <button
                    type="button"
                    onClick={() => setShowConfirmStop(false)}
                >
                    Keep Recording
                </button>
            </div>}
    </>)
}


function createEmptyStream() {
    const audioCtx = new AudioContext()
    const oscillator = audioCtx.createOscillator()
    const dest = audioCtx.createMediaStreamDestination()
    oscillator.connect(dest)
    oscillator.start()
    return dest.stream
}

function muteMonitorAudio(stream) {
    try {
        for (const track of stream.getAudioTracks()) {
            track.enabled = false
        }
        console.log('mute') 
    } catch (error) {
    }
}

function unMuteMonitorAudio(stream) {
    try {
        for (const track of stream.getAudioTracks()) {
            track.enabled = true
        }
        console.log('unmute') 
    } catch (error) {
    } 
}

/* 

TODO
- get rid of noise processing
- mute audio on record, unmute on stop


*/