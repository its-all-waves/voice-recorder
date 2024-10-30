export type RecState = 'STOPPED' | 'RECORDING' | 'PAUSED'

export type AudioActionType = 
    'TOGGLED_MIC' 
    | 'TOGGLED_RECORD_PAUSE' 
    | 'PRESSED_STOP' 
    | 'TOGGLED_MONITOR' 
    | 'REC_COUNTER_TICKED'

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints
 */
export type AudioTrackConstraints = {
    deviceId?: ConstrainDOMString;
    groupId?: ConstrainDOMString;
    autoGainControl?: ConstrainBoolean;
    channelCount?: ConstrainULong;
    echoCancellation?: ConstrainBoolean;
    latency?: ConstrainDouble;
    noiseSuppression?: ConstrainBoolean;
    sampleRate?: ConstrainULong;
    sampleSize?: ConstrainULong;
    volume?: ConstrainDouble;
  };

export type RecorderControlsProps = {
    recState: RecState, 
    isMonitoring: boolean, 
    isMicOn: boolean, 
    onClickMic: VoidFunction, 
    onClickRecord: VoidFunction, 
    onClickStop: VoidFunction, 
    onClickMonitor: VoidFunction 
}