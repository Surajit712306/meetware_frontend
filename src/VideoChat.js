import './VideoChat.css';
import {Switch, Route, Redirect} from 'react-router-dom';
import CreateRoom from './CreateRoom';
import Room from './Room';

const VideoChat = props => {
  return (
    <div className="app">
      <Switch>
        <Route path="/:roomId">
          <Room />
        </Route>
        <Route exact path="/">
          <CreateRoom />
        </Route>
        <Redirect to="/" />
      </Switch>
    </div>
  );
} 

export default VideoChat;
