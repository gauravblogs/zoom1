const socket = io();
const roomId = prompt("Enter room ID:");
const username = prompt("Enter your name:");
let localStream, recorder, chunks = [];
let peers = {};

const localVideo = document.getElementById("localVideo");
const remoteVideos = document.getElementById("remoteVideos");
const messages = document.getElementById("messages");

navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
  localStream = stream;
  localVideo.srcObject = stream;
  socket.emit("join", { roomId, username });
});

socket.on("all-users", async (users) => {
  for (const userId of users) {
    const pc = createPeer(userId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("signal", { to: userId, signal: { description: pc.localDescription } });
  }
});

socket.on("user-joined", (userId) => {
  if (!peers[userId]) peers[userId] = createPeer(userId);
});

socket.on("signal", async ({ from, signal }) => {
  if (!peers[from]) peers[from] = createPeer(from);
  const pc = peers[from];
  if (signal.description) {
    await pc.setRemoteDescription(new RTCSessionDescription(signal.description));
    if (signal.description.type === "offer") {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("signal", { to: from, signal: { description: pc.localDescription } });
    }
  } else if (signal.candidate) {
    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
  }
});

socket.on("chat-message", ({ username, message }) => {
  const div = document.createElement("div");
  div.innerText = username + ": " + message;
  messages.appendChild(div);
});

socket.on("reaction", ({ from, emoji }) => {
  alert(`User ${from} reacted with ${emoji}`);
});

function createPeer(id) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  const remote = document.createElement("video");
  remote.autoplay = true;
  remote.playsInline = true;
  remote.id = id;
  const remoteStream = new MediaStream();
  remote.srcObject = remoteStream;
  pc.ontrack = (e) => remoteStream.addTrack(e.track);
  remoteVideos.appendChild(remote);
  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit("signal", { to: id, signal: { candidate: e.candidate } });
  };
  return pc;
}

function toggleMute() {
  localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
}
function toggleCamera() {
  localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
}
function startRecording() {
  recorder = new MediaRecorder(localStream);
  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "recording.webm";
    a.click();
    chunks = [];
  };
  recorder.start();
}
function stopRecording() {
  if (recorder) recorder.stop();
}
function shareScreen() {
  navigator.mediaDevices.getDisplayMedia({ video: true }).then(screenStream => {
    const screenTrack = screenStream.getVideoTracks()[0];
    const sender = Object.values(peers)[0].getSenders().find(s => s.track.kind === "video");
    sender.replaceTrack(screenTrack);
  });
}
function raiseHand() {
  socket.emit("reaction", { roomId, emoji: "✋" });
}
function sendMsg() {
  const input = document.getElementById("msgInput");
  socket.emit("chat-message", { roomId, username, message: input.value });
  input.value = "";
}
