import {useState} from 'react';
import './CreateRoom.css';
import {useHistory} from 'react-router-dom';
import axios from 'axios';
import Loader from './components/Loader';
import Error from './components/Error';
import * as settings from './config/settings';


const CreateRoom = props => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState();
    const history = useHistory();
  
    const createRoom = async () => {
        const URL = `${settings.BACKEND_HOST}/room`;
        try
        {
          setLoading(true);
          const {data} = await axios.get(URL);
          history.push(`/${data.payload}`);
          return;
        }
        catch(err)
        {
          setError(err.message);
        }
        setLoading(false);
    }
  
    return (
      <div className="create-room">
          <h3 className="brand">Meetware</h3>
          <div className="app-description">
            Meetware is an application for video conferencing, meeting, video chatting
            , broadcasting and so on.
            <br/>
            Create a meeting and share the link to join.
          </div>
          <button onClick={createRoom} className="create-room__btn">
            Create Meeting
          </button>
          {loading && <Loader />}
          {error && <Error error={error} />}
      </div>
    );
  }

  export default CreateRoom;