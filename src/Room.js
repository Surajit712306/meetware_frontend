import {useEffect, useRef, useState} from 'react';
import './Room.css';
import Error from './components/Error';
import {io} from 'socket.io-client';
import * as settings from './config/settings';
import {useParams, useHistory} from 'react-router-dom';
import {v4 as uuidv4} from 'uuid';
import ScreenShareIcon from '@material-ui/icons/ScreenShare';
import VolumeOffIcon from '@material-ui/icons/VolumeOff';
import VolumeUpIcon from '@material-ui/icons/VolumeUp';
import VideocamIcon from '@material-ui/icons/Videocam';
import VideocamOffIcon from '@material-ui/icons/VideocamOff';
import CallEndIcon from '@material-ui/icons/CallEnd';
import LinkIcon from '@material-ui/icons/Link';
import FullscreenIcon from '@material-ui/icons/Fullscreen';
import DesktopAccessDisabledIcon from '@material-ui/icons/DesktopAccessDisabled';
import PersonalVideoIcon from '@material-ui/icons/PersonalVideo';
import SnackBar from './components/SnackBar';

const RemoteVideo = ({peer}) => {
    const videoRef = useRef();
    useEffect(() => {
        const video = videoRef.current;
        video.onloadedmetadata = e => {
            video.play();
        }
        peer.ontrack = e => {
            const stream = e.streams[0];
            video.srcObject = stream;
        }

    }, [peer]);

    const fullScreen = e => {
        if(!document.fullscreenElement)
        {
            videoRef.current.requestFullscreen();
        }
        else
        {
            document.exitFullscreen();
        }
    }

    return (
        <div className="user">
            <video className="user__video" ref={videoRef}>
            </video>
            <div className="user__action" onClick={fullScreen}>
                <FullscreenIcon />
            </div>
        </div> 
    );
}

const Room = props => {
    const streamRef = useRef();
    const localVideoRef = useRef();
    const socketRef = useRef();
    const remoteUsersRef = useRef([]);
    const [remoteUsers, setRemoteUsers] = useState([]);
    const [error, setError] = useState();
    const params = useParams();
    const displayStreamRef = useRef();
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isMute, setIsMute] = useState(false);
    const [isCamera, setIsCamera] = useState(true);
    const history = useHistory();
    const [gotStream, setGotStream] = useState(false);
    const [displayVideo, setDisplayVideo] = useState(true);
    const localUserRef = useRef();
    const [linkCopied, setLinkCopied] = useState(false);

    useEffect(() => {

      const getLocalVideoStream = async () => {
        try
        {
          const mediaStreamConstraints = {
              video: true,
              audio: true
          };
          const stream = await navigator.mediaDevices.getUserMedia(mediaStreamConstraints);
          streamRef.current = stream;
          localVideoRef.current.srcObject = stream;
          setGotStream(true);

          const socket = io(settings.BACKEND_HOST);
          socketRef.current = socket;
          socket.emit('join-room', params.roomId);

          const dataChannelEvents = dc => {
            dc.onopen = e => {
                console.log("Data channel is opened.")
            }
            
            dc.onmessage = e => {
                console.log(`Data channel message: ${e.data}.`)
            }
    
            dc.onerror = e => {
                console.log(`Data channel error: ${e}`)
            }
    
            dc.onclose = e => {
                console.log(`Data channel is closed.`);
            }
        }

     const createPeer = (calleeId) => {
        const peer = new RTCPeerConnection();
        peer.onnegotiationneeded = async e => {
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);

            socket.emit('offer', {
                sdp: peer.localDescription,
                calleeId
            });
        }

        peer.onicecandidate = e => {
            if(e.candidate)
            {
                socket.emit('icecandidate', {
                    candidate: e.candidate,
                    receiver: calleeId
                });
            }
        }

        const dc = peer.createDataChannel(uuidv4());
        peer.dc = dc;

        dataChannelEvents(dc);

        peer.onsignalingstatechange = e => {
            console.log('Signaling state', peer.signalingState);
        }

        peer.onconnectionstatechange = e => {
            console.log('Connection state', peer.connectionState);
        }

        return peer;
     }

     const addPeer = (callerId) => {
         const peer = new RTCPeerConnection();
         peer.onicecandidate = e => {
             if(e.candidate)
             {
                 socket.emit('icecandidate', {
                     candidate: e.candidate,
                     receiver: callerId
                 });
             }
         }

         peer.ondatachannel = e => {
             const dc = e.channel;
             peer.dc = dc;

             dataChannelEvents(dc);
         }

         return peer;
     }

          const handleRemoteUsersConnection = (remoteUserIds) => {
              remoteUserIds.forEach(async remoteUserId => {
                  const peer = createPeer(remoteUserId);
                  stream.getTracks().forEach(track => peer.addTrack(track, stream));
                  const remoteUser = {
                        id: remoteUserId,
                        peer
                  };
                  remoteUsersRef.current.push(remoteUser);
                  setRemoteUsers(prevRemoteUsers => [
                      ...prevRemoteUsers,
                      remoteUser
                  ]);
              });
          }
          socket.on('remoteusers-connected', handleRemoteUsersConnection);

          const shareScreenInitially = async  peer => {
              const sender = peer.getSenders().find(sender => sender.track.kind === 'video');
              await sender.replaceTrack(displayStreamRef.current.getVideoTracks()[0]);

              displayStreamRef.current.getVideoTracks()[0].onended = e => {
                  const peers = remoteUsersRef.current.map(remoteUser => remoteUser.peer);
                  peers.forEach(async peer => {
                      const sender = peer.getSenders().find(sender => sender.track.kind === 'video');
                      if(streamRef.current.getVideoTracks()[0])
                      {
                        await sender.replaceTrack(streamRef.current.getVideoTracks()[0]);
                      }
                  });
                  localVideoRef.current.srcObject = streamRef.current;
                  displayStreamRef.current = null;
                  setIsScreenSharing(false);
              }
          }

          socket.on('offer', async payload => {
            const peer =  addPeer(payload.callerId);
            const remoteUser = {
                id: payload.callerId,
                peer
            };
            remoteUsersRef.current.push(remoteUser);
            setRemoteUsers(prevRemoteUsers => [
                ...prevRemoteUsers,
                remoteUser
            ]);

             const sdp = new RTCSessionDescription(payload.sdp);
             await peer.setRemoteDescription(sdp);
             stream.getTracks().forEach(track => peer.addTrack(track, stream));
             if(displayStreamRef.current)
             {
                await shareScreenInitially(remoteUser.peer);
             }
             const answer = await peer.createAnswer();
             await peer.setLocalDescription(answer);             
             socket.emit('answer', {
                 sdp: peer.localDescription,
                 callerId: payload.callerId
             });

          });

          socket.on('answer', async payload => {
                const remoteUser = remoteUsersRef.current.find(remoteUser => remoteUser.id === payload.calleeId);
                if(remoteUser)
                {
                    const {peer} = remoteUser;
                    const sdp = new RTCSessionDescription(payload.sdp);
                    await peer.setRemoteDescription(sdp);
                }
          });

          socket.on('icecandidate', async payload => {
              const remoteUser = remoteUsersRef.current.find(remoteUser => remoteUser.id === payload.sender);
              if(remoteUser)
              {
                const {peer} = remoteUser;
                const candidate = new RTCIceCandidate(payload.candidate);
                await peer.addIceCandidate(candidate);
              }
          });

          socket.on('remoteuser-disconnected', remoteUserId => {
              remoteUsersRef.current = remoteUsersRef.current.filter(remoteUser => remoteUser.id !== remoteUserId);
              setRemoteUsers(prevRemoteUsers => prevRemoteUsers.filter(remoteUser => remoteUser.id !== remoteUserId));
          });

        }
        catch(err)
        {
            setError(err.message);
        }
      }

      getLocalVideoStream();
    }, []);

    useEffect(() => {
        const localVideo = localVideoRef.current;
        localVideo.onloadedmetadata = e => {
            localVideo.play();
        }

    }, []);

    const shareScreen = async e => {
        setIsScreenSharing(true);
        const displayMediaOptions = {
            cursor: ["always", "motion"]
        };
        try
        {
            const displayStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
            displayStreamRef.current = displayStream;
            localVideoRef.current.srcObject = displayStream;

            const peers = remoteUsers.map(remoteUser => remoteUser.peer);
            peers.forEach(async peer => {
                const sender = peer.getSenders().find(sender => sender.track.kind === 'video');
                await sender.replaceTrack(displayStream.getVideoTracks()[0]);
            });

            displayStream.getVideoTracks()[0].onended = e => {
                peers.forEach(async peer => {
                    const sender = peer.getSenders().find(sender => sender.track.kind === 'video');
                    if(streamRef.current.getVideoTracks()[0])
                    {
                        await sender.replaceTrack(streamRef.current.getVideoTracks()[0]);
                    }
                });     
                localVideoRef.current.srcObject = streamRef.current;
                displayStreamRef.current = null;
                setIsScreenSharing(false);
            }
        }
        catch(err)
        {
            setIsScreenSharing(false);
        }
    }

    const changeLocalStream = async (isVideo) => {
        const peers = remoteUsers.map(remoteUser => remoteUser.peer);
        streamRef.current.getTracks().forEach(track => {
            track.stop();
            streamRef.current.removeTrack(track);
        });

            const mediaStreamConstraints = {
                video: isVideo ? true : false,
                audio: true
            };
            const stream = await navigator.mediaDevices.getUserMedia(mediaStreamConstraints);
            if(isMute)
            {
                stream.getAudioTracks().forEach(track => {
                    track.enabled = false;
                });
            }

            stream.getTracks().forEach(track => {
                peers.forEach(peer => {
                    peer.getSenders().forEach(sender => {
                        if(sender.track.kind === track.kind)
                        {
                            sender.replaceTrack(track);
                        }
                    });
                });
            });
            streamRef.current = stream;
            localVideoRef.current.srcObject = stream;

    }

    const toggleMute = async () => {
        if(isMute)
        {
            streamRef.current.getAudioTracks().forEach(track => {
                track.enabled = true;
            });
        }
        else
        {
            streamRef.current.getAudioTracks().forEach(track => {
                    track.enabled = false;
            });
        }
        setIsMute(prevIsMute => !prevIsMute);
    }

    const toggleCamera = async () => {
        if(isCamera)
        {
            await changeLocalStream(false)
        }
        else
        {
            await changeLocalStream(true)
        }
        setIsCamera(prveIsCamera => !prveIsCamera);
    }

    const copyLink = async () => {
        try
        {
            await navigator.clipboard.writeText(window.location.href);
            setLinkCopied(true);
        }
        catch(err){}
    }

    const fullScreen = () => {
        if(!document.fullscreenElement)
        {
            localVideoRef.current.requestFullscreen();
        }
        else
        {
            document.exitFullscreen();
        }
    }

    const toggleLocalVideo = () => {
        if(displayVideo)
        {
            localUserRef.current.style.display = 'none';
        }
        else
        {
            localUserRef.current.style.display = 'block';
        }
        setDisplayVideo(prevDisplayVideo => !prevDisplayVideo);
    }

    return (<>
                {error && <Error error={error} />}
                <div className="room">
                    <div className="user user--local" ref={localUserRef}>
                        <video className={`user__video  ${!isCamera && "camera-off"}`} ref={localVideoRef}></video>
                        {!isCamera && <div className="user__video video--local camera-off-placeholder">
                            Camera off
                        </div>}
                        <div className="user__action" onClick={fullScreen}>
                            <FullscreenIcon />
                        </div>
                    </div>
                    {remoteUsers.map((remoteUser, index) => (
                        <RemoteVideo key={index} peer={remoteUser.peer} />
                    ))}
                    <div className="actions">
                        <div className="action" onClick={copyLink}>
                            <LinkIcon  />
                        </div>
                        {linkCopied && <SnackBar closeSnackBar={() => {
                            setLinkCopied(false);
                        }}>
                                Link copied to share
                            </SnackBar>}
                        <div className="action" onClick={toggleLocalVideo}>
                            {displayVideo ? <PersonalVideoIcon /> : <DesktopAccessDisabledIcon />}
                        </div>
                        {gotStream && <div className="action" onClick={toggleMute}>
                            {!isMute ? <VolumeUpIcon /> : <VolumeOffIcon />}
                        </div>}
                        {gotStream && <div className="action" onClick={toggleCamera}>
                            {isCamera ? <VideocamIcon /> 
                            : <VideocamOffIcon />}
                        </div>}
                        <div className="action" onClick={() => {
                                streamRef.current?.getTracks().forEach(track => {
                                    track.stop(); 
                                });
                                socketRef.current?.disconnect();
                                history.push('/');
                            }} > 
                            <CallEndIcon />
                        </div>
                        {!isScreenSharing && remoteUsers.length > 0 && 
                                <div className="action"  onClick={shareScreen} >
                                    <ScreenShareIcon className="action"/>
                                </div>}
                    </div>
                </div>
            </>);
}

export default Room;