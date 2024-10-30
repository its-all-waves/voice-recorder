import './RecorderControls.css'

import micIcon from './assets/mic.white.svg'
import recordIcon from './assets/record.white.svg'
import pauseIcon from './assets/pause.white.svg'
import stopIcon from './assets/stop.white.svg'
import monitorIcon from './assets/headphones.white.svg'
import { createContext } from 'react'
import { useContext } from 'react'

/** @typedef {import('./types').RecState} RecState */
/** @typedef {import('./types').AudioActionType} AudioActionType */
/** @typedef {import('./types').RecorderControlsProps} RecorderControlsProps */

const AudioControlsCtx = createContext()

/** @param {{ recState: RecState, isMonitoring: boolean, isMicOn: boolean, onClickMic: VoidFunction, onClickRecord: VoidFunction, onClickStop: VoidFunction, onClickMonitor: VoidFunction }} */
export default function RecorderControls({
    recState = 'STOPPED',
    isMonitoring = false,
    isMicOn = false,
    onClickMic,
    onClickRecord,
    onClickStop,
    onClickMonitor,
}) {
    return (
        <div className="recorder-controls">
            <AudioControlsCtx.Provider
                value={{
                    state: recState,
                    isMicOn,
                    isMonitoring
                }}>
                <MicOnButton onClick={onClickMic} />
                <RecordPauseButton onClick={onClickRecord} />
                <StopButton onClick={onClickStop} />
                <MonitorButton onClick={onClickMonitor} />
            </AudioControlsCtx.Provider>
        </div>
    )
}

/** @param {{ state: RecState }} */
function MicOnButton({ onClick }) {
    const { state, isMicOn } = useContext(AudioControlsCtx)
    const style =  { background: isMicOn ? 'goldenrod' : 'black' }
    return (
        <AudioControl
            type="MIC_ON"
            img={micIcon}
            style={style}
            alt={`Turn Microphone ${isMicOn ? 'Off' : 'On'}`}
            state={state}
            disabled={state === "RECORDING" || state === "PAUSED"}
            onClick={onClick}
        />
    )
}

/** @param {{ state: RecState }} */
function RecordPauseButton({ onClick }) {
    const { state, isMicOn } = useContext(AudioControlsCtx)
    const style = { background: 'red' }
    return (
        <AudioControl
            type={state === "RECORDING" ? "PAUSE" : "RECORD"}
            img={state === "RECORDING" ? pauseIcon : recordIcon}
            style={style}
            alt={state === "RECORDING" ? "Pause" : "Record"}
            state={state}
            disabled={!isMicOn}
            onClick={onClick}
        />
    )
}

/** @param {{ state: RecState }} */
function StopButton({ onClick }) {
    const { state, isMicOn } = useContext(AudioControlsCtx)
    return (
        <AudioControl
            type="STOP"
            img={stopIcon}
            alt="Stop"
            state={state}
            onClick={onClick}
            disabled={state === "STOPPED"}
        />
    )
}

/** @param {{ state: RecState }} */
function MonitorButton({ onClick }) {
    const { state, isMicOn, isMonitoring } = useContext(AudioControlsCtx)
    const style = isMonitoring ? { background: 'goldenrod' } : undefined
    return (
        <AudioControl
            type="MONITOR"
            img={monitorIcon}
            style={style}
            alt="Listen [ WARNING: Use Headphones! ]"
            state={state}
            onClick={onClick}
        />
    )
}

/** @param {{ type: ButtonType, style: React.CSSProperties }} */
function AudioControl({
    type,
    state,
    onClick,
    className,
    img,
    alt,
    style,
    disabled
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={style}
        >
            <img src={img} alt={alt} title={alt} />
        </button>
    )
}