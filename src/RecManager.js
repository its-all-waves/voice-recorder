// no async in a constructor -- do it outside the class
const [audioInputs, audioOutputs] = await getAudioIOOptions()

/** Hold all Web Audio API and recording-related entities. */
class RecManager {
	constructor() {
		// create web audio api entities
		this.audioCtx = new AudioContext()
		this.output = this.audioCtx.destination
		this.gainNode = this.audioCtx.createGain()
		this.gainNode.gain.value = 0
		this.gainNode.connect(this.output)
		this.recorder = null

		this.recordedChunks = []
		this.recCounterInterval = null

		// get supported constraints and audio io
		this.supportedConstraints =
			navigator.mediaDevices.getSupportedConstraints()
		
		this.audioInputs = audioInputs
		this.audioOutputs = audioOutputs
	}
}

async function getAudioIOOptions() {
	const mediaIODevices = await navigator.mediaDevices.enumerateDevices()
	const audioInputs = mediaIODevices.filter(t => t.kind === 'audioinput')
	const audioOutputs = mediaIODevices.filter(t => t.kind === 'audiooutput')
	return [audioInputs, audioOutputs]
}

export const recManager = new RecManager()