import './App.css';
import {BrowserRouter as Router} from 'react-router-dom';
import VideoChat from './VideoChat';

function App() {
  return (
    <Router> 
        <VideoChat />
    </Router>
  );
}

export default App;
