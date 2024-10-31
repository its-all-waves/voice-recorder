/** @typedef {import('./types').AudioTrackConstraints} AudioTrackConstraints */

/** 
 * @param {{ audioInputs: Array, audioOutputs: Array, supportedConstraints: ... }}
 */
export default function RecorderSettings({
    audioInputs,
    audioOutputs,
    supportedConstraints,
}) {

    return (
        <div className="recorder-settings">

            <select name="audio-inputs" id="audio-inputs">
                {audioInputs.map(input => (
                    <option value={input.deviceId}>{input.label}</option>
                ))}
            </select>

            <select name="audio-outputs" id="audio-outputs">
                {audioInputs.map(output => (
                    <option value={output.deviceId}>{output.label}</option>
                ))}
            </select>

            <select name="audio-constraints" id="audio-constraints" multiple >
                {supportedConstraints.map(constraint => (
                    <option value={constraint}></option>
                ))}
            </select>
        </div>
    )
}