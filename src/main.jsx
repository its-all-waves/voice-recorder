import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

import ReactMediaRecorderExample from './ReactMediaRecorder.jsx'
import HandRolledRecorder from './HandRolledRecorder.jsx'

createRoot(document.getElementById('root')).render(
    // <ReactMediaRecorderExample />
    // <HandRolledRecorder />
    <App /> 
)
