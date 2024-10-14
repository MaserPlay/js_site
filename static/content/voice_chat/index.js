const userStatus = {
    mute: false,
    username: localStorage.getItem("username") ?? "user#" + Math.floor(Math.random() * 999999),
    online: false,
  };
  let madiaRecorder;
  var settings = JSON.parse(localStorage.getItem("settings")) ?? {
    record_length: 500,
    connect_notification: false,
    disconnect_notification: true,
    mic: ""
  }
  if (localStorage.getItem("username") == null)
  {
    $("#username_startup").val(userStatus.username)
    new bootstrap.Modal('#startup_select').show()
  }
  if (Notification.permission == 'granted')
  {
    (new bootstrap.Toast('#notification_toast')).hide()
  }
  let settings_modal = new bootstrap.Modal('#settings_toast_div');
  var disconnected_toast = new bootstrap.Toast('#disconnected_toast');
  var disconnected_notification = {close: ()=>{}};
  var connected_notification = {close: ()=>{}};
  
  const usernameInput = $("#username");
  const usernameLabel = document.getElementById("username-label");
  const usersDiv = $("#users");
  var ping_p = $("#ping");
  
  usernameInput.val(userStatus.username);
  usernameLabel.innerText = userStatus.username;
  
  var socket = io((location.protocol !== 'https:' ? 'ws' : 'wss') + '://' + document.location.host);
  socket.on("connect", () => {
    ping_p.removeClass("text-decoration-line-through")
    disconnected_toast.hide(); disconnected_notification.close();settings.connect_notification&&(connected_notification = new Notification("js.maserplay.ru", { body: `Connected.`, icon: "/favicon.ico" })); socket.emit("userInformation", userStatus);
  });
  
  socket.on("connect_error", (err) => {
    console.error(err);
  });
  
  socket.on("disconnect", (reason) => {
    ping_p.addClass("text-decoration-line-through")
    disconnected_toast.show();settings.disconnect_notification&&(disconnected_notification = new Notification("js.maserplay.ru", { body: `Disconected. ${reason.capitalize()}`, icon: "/favicon.ico" }));connected_notification.close();
  });
  
  
  function mainFunction() {
  
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      if ($('#microphone_select').html().trim() === "")
      {stream.getTracks().forEach((track)=>{
        $('#microphone_select').append($('<option>', {
            value: track.id,
            text: track.label,
            disabled: track.muted
        }));
      })}
      if (settings.mic&&settings.mic.trim() !== "")
      {
        stream.addTrack(stream.getTrackById(settings.mic))
      }
      madiaRecorder = new MediaRecorder(stream);
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
    }).catch((err) => {
      console.error(err);                           // will show "foo"
  }); 
  
    socket.on("send", function (data) {
      var audio = new Audio(data);
      audio.play();
    });  
  
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
    usernameLabel.innerText = userStatus.username;
    emitUserInformation();
  }
  
  function toggleConnection(e) {
    userStatus.online = !userStatus.online;
  
    editButtonClass(e, userStatus.online);
    emitUserInformation();
    mainFunction();
  }
  
  function toggleMute(e) {
    userStatus.mute = !userStatus.mute;
    if (userStatus.mute){madiaRecorder&&madiaRecorder.stop()}
  
    editButtonClass(e, userStatus.mute);
    emitUserInformation();
  }
  
  
  function editButtonClass(target, bool) {
    const classList = target.classList;
    classList.remove("active");
  
    if (bool)
      return classList.add("active");
  
    classList.remove("active");
  }
  
  function emitUserInformation() {
    socket.emit("userInformation", userStatus);
  }
  
  
  
  function userVisible(name, vis, mic){
    if (vis){
      usersDiv.html(usersDiv.html() + `<div id=\"card-${name}\" class=\"col-md-3\"><div class=\"card\"><div class=\"card-body\">${name}<span class="bi ${mic ? "bi-mic" : "bi-mic-mute"}"></span></div></div></div>`);
    } else {
      $(`#card-${name}`).remove()
    }
  }
  function usersReset(){
    usersDiv.html("")
  }
  (()=>{
    $("#rec_length_num").val(settings.record_length)
    $("#rec_length").val(settings.record_length)
    $("#disconnect_Notifications_check").prop('checked', settings.disconnect_notification)
    $("#Connect_Notifications_check").prop('checked', settings.connect_notification)
  })();
  function saveSettings(){
    settings.connect_notification = $("#Connect_Notifications_check").prop('checked')
    settings.disconnect_notification = $("#disconnect_Notifications_check").prop('checked')
    settings.record_length = $("#rec_length_num").val();
    localStorage.setItem("settings", JSON.stringify(settings))
  }
  $('#microphone_select').on( "change", ()=>{settings.mic=$('#microphone_select').val().trim()})
  
setInterval(() => {
  const start = Date.now();

  socket.emit("ping", () => {
    const duration = Date.now() - start;
    ping_p.html(duration);
    // console.log(duration);
  });
}, 1000);