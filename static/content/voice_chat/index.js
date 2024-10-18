const userStatus = {
    mute: false,
    username: localStorage.getItem("username") ?? "user#" + Math.floor(Math.random() * 999999),
    online: false,
  };
const settings = JSON.parse(localStorage.getItem("settings")) ?? {
  record_length: 500,
  mic: "",
  speaker: "",
  mic_disconnect_notification: true,
  connect_notification: false,
  disconnect_notification: true,
  height_ping_notification: -1,
  debug: false,
  }

  let settings_modal = new bootstrap.Modal('#settings_toast_div');
  var disconnected_toast = new bootstrap.Toast('#disconnected_toast');
  const audioContext = new AudioContext();
  
  const usernameInput = $("#username");
  const usernameLabel = $("#username-label");
  const usersDiv = $("#users");
  var ping_p = $("#ping");
  
  var disconnected_notification = {close: ()=>{}};
  var mic_disconnected_notification = {close: ()=>{}};
  var connected_notification = {close: ()=>{}};
  var height_ping_notification = {close: ()=>{}};
  
  let madiaRecorder;
  
  if (localStorage.getItem("username") == null)
  {
    $("#username_startup").val(userStatus.username)
    new bootstrap.Modal('#startup_select').show()
  }
  if (Notification.permission == 'granted')
  {
    (new bootstrap.Toast('#notification_toast')).hide()
  }
  if ("setSinkId" in AudioContext.prototype) {
  } else {
    $("#speaker_select").prop('disabled', true)
  }

  usernameInput.val(userStatus.username);
  usernameLabel.text(userStatus.username);
  
  var socket = io(`${document.location.origin}`, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax : 5000,
      reconnectionAttempts: 5
    });
  socket.on("connect", () => {
    ping_p.removeClass("text-decoration-line-through");
    disconnected_notification.close();
    settings.connect_notification&&(connected_notification = new Notification("js.maserplay.ru", { body: `Connected.`, icon: "/favicon.ico" }));
    socket.emit("userInformation", userStatus);
    $("#onl_btn").attr("disabled", false)
    usersDiv.html("")
  });
  
  socket.on("connect_error", (err) => {
    console.error(err);
  });
  
  socket.on("disconnect", (reason) => {
    ping_p.addClass("text-decoration-line-through");
    settings.disconnect_notification&&(disconnected_notification = new Notification("js.maserplay.ru", { body: `Disconected. ${reason.capitalize()}`, icon: "/favicon.ico" }));
    connected_notification.close();
    $("#onl_btn").attr("disabled", true)
    usersDiv.html("<div class='text-center'> <div class='spinner-border' role='status'> <span class='visually-hidden'>Loading...</span> </div> </div>")
  });
  
  function getmic(){
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      MicAvailable(true)
      $('#microphone_select').html("")
      stream.getAudioTracks().forEach((track)=>{
        $('#microphone_select').append($('<option>', {
            value: track.id,
            text: track.label,
            disabled: track.muted
        }));
      })
    }).catch((e)=>{if (e.message == "Requested device not found"){MicAvailable(false)}; console.error(e)})
  }
  async function getspe(){
    if ("setSinkId" in AudioContext.prototype) {
      $("#speaker_select").html("");
      (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind == "audiooutput").forEach((device)=>{
        $("#speaker_select").append($('<option>', {
          value: device.deviceId,
          text: device.label,
      }));
      })
      
    } else {
      console.error("setSinkId not supported")
    }
  }
  
  function mainFunction() {

  
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      MicAvailable(true)
      if (settings.mic&&settings.mic.trim() !== "" && stream.getTrackById(settings.mic))
      {
        stream.addTrack(stream.getTrackById(settings.mic))
      }

      madiaRecorder = new MediaRecorder(stream, { 'type': 'audio/ogg; codecs=opus' });
      madiaRecorder.start();
  
      var audioChunks = [];
  
      madiaRecorder.addEventListener("dataavailable", function (event) {
        audioChunks.push(event.data);
      });
  
      madiaRecorder.addEventListener("stop", function () {
        var audioBlob = new Blob(audioChunks);
  
        audioChunks = [];
  
        var fileReader = new FileReader();
        fileReader.readAsDataURL(audioBlob);
        fileReader.onloadend = function () {
          if (!userStatus.online) return;
  
          var base64String = fileReader.result;
          socket.emit("voice", base64String);
  
        };
  
        if (!userStatus.mute)
        {madiaRecorder.start();}
  
  
        setTimeout(function () {
          madiaRecorder.stop();
        }, settings.record_length);
      });
  
      setTimeout(function () {
        madiaRecorder.stop();
      }, settings.record_length);
    }).catch((e) => {
      if (e.message == "Requested device not found"){MicAvailable(false)}
      console.error(e);                           // will show "foo"
  });    
  }

  socket.on("send", async function (data) {
    if (!userStatus.online) return;
    if (!CheckUrl(data)) {
      console.warn("url isn`t valid")
      return;
    };

    // Grab audio track via fetch() for convolver node
    try {
      const response = await fetch(data);
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength <= 0){
        console.warn("arrayBuffer.byteLength <= 0")
        return;
      };
      const decodedAudio = await audioContext.decodeAudioData(arrayBuffer);
      source = audioContext.createBufferSource();
      source.buffer = decodedAudio;
      source.connect(audioContext.destination);
      source.start();
    } catch (error) {
      console.error(
        `Unable to fetch the audio file. Error: ${error.message}`
      );
    }
  });  

  function CheckUrl(string) {
    let url;      
    try {
      url = new URL(string);
    } catch (_) {
      return false;  
    }    
    return !url.protocol || url.protocol == "data:";
  }

  socket.on("usersUpdate", function (data) {
    usersReset();
    for (const key in data) {
      if (!Object.hasOwnProperty.call(data, key)) continue;
      const element = data[key];
      element.mute

      userVisible(element.username, true, !element.mute);  
    }
  });
  
  function changeUsername(name) {
    localStorage.setItem("username", name)
    userStatus.username = name;
    usernameLabel.text(userStatus.username);
    emitUserInformation();
  }
  
  function ChangeConnection(conn) {
    userStatus.online = conn;
  
    editButtonClass($("#onl_btn"), userStatus.online);
    emitUserInformation();
    mainFunction();
  }
  
  function ChangeMute(mute) {
    userStatus.mute = mute;
    if (madiaRecorder)
    {
      if (userStatus.mute){madiaRecorder.stop()}
      else {
        madiaRecorder.start();

        setTimeout(function () {
          madiaRecorder.stop();
        }, settings.record_length);
      }
    }
  
    editButtonClass($("#mute_btn"), userStatus.mute);
    emitUserInformation(); 
  }
  
  
  function editButtonClass(target, bool) {
    target.removeClass("active");
  
    if (bool)
      return target.addClass("active");
  
    target.removeClass("active");
  }
  
  function emitUserInformation() {
    socket.emit("userInformation", userStatus);
  }
  
  
  
  function userVisible(name, vis, mic){
    if (vis){
      usersDiv.html(usersDiv.html() + `<div class=\"col-md-3\"><div class=\"card\"><div class=\"card-body\">${String(name).replace("<", "").replace(">", ">")}<span class="bi ${mic ? "bi-mic" : "bi-mic-mute"}"></span></div></div></div>`);
    } else {
      $(`#card-${name}`).remove()
    }
  }
  function usersReset(){
    usersDiv.html("")
  }
  function MicAvailable(isavailable) {
    if (settings.mic_disconnect_notification)
    {
      if (!isavailable)
      {
        mic_disconnected_notification = new Notification("js.maserplay.ru", { body: `Microphone disconnected.`, icon: "/favicon.ico" })
      }
      else {
        mic_disconnected_notification.close()
      }
      
    }
    if (!isavailable)
    {ChangeMute(true);}
    $("#mute_btn").attr("disabled", !isavailable);
  }
  (()=>{ //load settings
    $("#disconnect_Notifications_check").prop('checked', settings.disconnect_notification)
    $("#Connect_Notifications_check").prop('checked', settings.connect_notification)
    $("#mic_disconnect_Notifications_check").prop('checked', settings.mic_disconnect_notification)
    $("#height_ping_Notifications_check").prop('checked', settings.height_ping_notification > 0);
    if (settings.height_ping_notification > 0){
      $("#height_ping_Notifications_check").change()
      $("#height_ping_num").val(settings.height_ping_notification)
    }

    $("#rec_length_num").val(settings.record_length)
    $("#rec_length").val(settings.record_length)
    $("#Debug_mode").prop('checked', settings.debug)
    audioContext.setSinkId(settings.speaker);
  })()
  function saveSettings(){
    settings.mic_disconnect_notification = $("#mic_disconnect_Notifications_check").prop('checked')
    settings.connect_notification = $("#Connect_Notifications_check").prop('checked')
    settings.disconnect_notification = $("#disconnect_Notifications_check").prop('checked')
    if (!$("#height_ping_Notifications_check").prop('checked')){
      settings.height_ping_notification = Number(-1);
    } else {
      settings.height_ping_notification = Number($("#height_ping_num").val());
    }

    settings.record_length = Number($("#rec_length_num").val());
    settings.debug = $("#mic_disconnect_Notifications_check").prop('checked')
    settings.mic=$('#microphone_select').val()?.trim() ?? "";
    settings.speaker=(($('#speaker_select').val()?.trim() === "default") ? "" : $('#speaker_select').val()?.trim()) ?? "";
    audioContext.setSinkId(settings.speaker);
    localStorage.setItem("settings", JSON.stringify(settings))
  }  

setInterval(() => {
  const start = Date.now();

  socket.emit("ping", () => {
    const duration = Date.now() - start;
    ping_p.html(duration);
    if (settings.height_ping_notification > 0)
    {
      if (duration >= settings.height_ping_notification)
      {
        height_ping_notification = new Notification("js.maserplay.ru", { body: `Ping too height! ${duration}`, icon: "/favicon.ico" });
      } else {
        height_ping_notification.close();
      }
    }
  });
}, 1000);