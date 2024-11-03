var changeRoom = (to) => { }
(async () => {
  var lang = await (await langpromize).json()
  class User {
    username = "AnUnnamedUser";
    mute = false;
    online = false;
    constructor(name) {
      this.username = name;
    }
  }
  let doSpectogram = ()=>{}
  class MyUser extends User {
    constructor() {
      super(localStorage.getItem("username") ?? "user#" + Math.floor(Math.random() * 999999));
    }
    set Username(name) {
      localStorage.setItem("username", name);
      this.username = name;
      usernameLabel.html(name);
      emitUserInformation();
    }
    get Username() { return this.username }

    set Mute(m) {
      if (madiaRecorder) {
        if (m) { madiaRecorder.stop() ;}
        else {
          this.mute = m;
          madiaRecorder.start();

          setTimeout(function () {
            madiaRecorder.stop();
          }, settings.record_length);
          doSpectogram();
        }
      }
      this.mute = m;

      editButtonClass($("#mute_btn"), m);
      emitUserInformation();
    }
    get Mute() { return this.mute }

    set Online(onl) {
      this.online = onl;

      editButtonClass($("#onl_btn"), this.online);
      emitUserInformation();
      // if (madiaRecorder) {
      //   if (!onl) { madiaRecorder.stop() }
      // }
      if (onl)
        mainFunction();
    }
    get Online() { return this.online }
  }

  var socket = io({
    reconnection: true,
    reconnectionDelay: 1000
  }); //Create connection <--
  const userStatus = new MyUser();
  const settings = JSON.parse(localStorage.getItem("settings")) ?? {
    record_length: 500,
    mic: "",
    speaker: "",
    mic_disconnect_notification: true,
    connect_notification: false,
    disconnect_notification: false,
    height_ping_notification: -1,
    debug: false,
    self_spectogram: false,
  }
  
  var canvas = $("#self-spectogramm").get(0);
  var canvasContext = canvas.getContext("2d");

  let audioContext;

  const usernameInput = $("#username");
  const usernameLabel = $("#username-label");
  const usersDiv = $("#users");
  var ping_p = $("#ping");

  var disconnected_notification = { close: () => { } };
  var mic_disconnected_notification = { close: () => { } };
  var connected_notification = { close: () => { } };
  var height_ping_notification = { close: () => { } };

  let madiaRecorder;

  if (localStorage.getItem("username") == null) {
    $("#username_startup").val(userStatus.Username)
    new bootstrap.Modal('#startup_select').show()
  }
  if (Notification.permission == 'granted') {
    (new bootstrap.Toast('#notification_toast')).hide()
  }
  var haveSink = "setSinkId" in AudioContext.prototype;
  $("#speaker_select").prop('disabled', !haveSink)

  usernameInput.val(userStatus.Username);
  userStatus.Username = userStatus.Username;

  socket.on("connect", () => {
    ping_p.removeClass("text-decoration-line-through");
    disconnected_notification.close();
    settings.connect_notification && (connected_notification = new Notification("js.maserplay.ru", { body: lang["Connected"], icon: "/favicon.ico" }));
    socket.emit("userInformation", userStatus);
    $("#onl_btn").attr("disabled", false)
    usersDiv.html("")
  });

  socket.on("disconnect", (reason) => {
    ping_p.addClass("text-decoration-line-through");
    settings.disconnect_notification && (disconnected_notification = new Notification("js.maserplay.ru", { body: lang["Disconected"].format(reason.capitalize()), icon: "/favicon.ico" }));
    connected_notification.close();
    $("#onl_btn").attr("disabled", true)
    usersDiv.html(`<div class='text-center'> <div class='spinner-border' role='status'> <span class='visually-hidden'>${lang["Loading"]}...</span> </div> </div>`)
    $("#groupRooms").html(`<button class='btn btn-outline-secondary' type='button' disabled> <span class='spinner-border spinner-border-sm' role='status' aria-hidden='true'></span> <span class='visually-hidden'>${lang["Loading"]}...</span> </button>`)
  });
  socket.on("ChangeMute", (mute) => { if (mute) { return }; userStatus.Mute = mute; })
  socket.on("ChangeConnection", (conn) => { if (conn) { return }; userStatus.Online = conn; })
  socket.on("ChangeNickname", (nick) => { userStatus.Username = nick; })

  function getmic() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      MicAvailable(true)
      $('#microphone_select').html("")
      stream.getAudioTracks().forEach((track) => {
        $('#microphone_select').append($('<option>', {
          value: track.id,
          text: track.label,
          disabled: track.muted
        }));
      })
    }).catch((e) => { if (e.message == "Requested device not found") { MicAvailable(false) }; console.error(e) })
  }
  async function getspe() {
    if ("setSinkId" in AudioContext.prototype) {
      $("#speaker_select").html("");
      (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind == "audiooutput").forEach((device) => {
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
      if (settings.mic && settings.mic.trim() !== "" && stream.getTrackById(settings.mic)) {
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
          if (!userStatus.Online) return;

          var base64String = fileReader.result;
          socket.emit("voice", base64String);

        };

        if (!userStatus.Mute && userStatus.Online) { madiaRecorder.start(); }


        // clearTimeout(timeout)
        setTimeout(function () {
          madiaRecorder.stop();
        }, settings.record_length);
      });

      setTimeout(function () {
        madiaRecorder.stop();
      }, settings.record_length);
      
      doSpectogram =()=>{
        canvas.width = canvas.getBoundingClientRect().width;
        const audioContextInput = new AudioContext();
        const analyser = audioContextInput.createAnalyser();
        analyser.minDecibels = -90;
        analyser.maxDecibels = -30;
        analyser.smoothingTimeConstant = 0.85;
        audioContextInput.createMediaStreamSource(stream).connect(analyser);
  
        const WIDTH = canvas.width;
        const HEIGHT = canvas.height;
        canvasContext.fillStyle = `rgba(${getComputedStyle(canvas).getPropertyValue("--bs-secondary-rgb")},1)`;
        canvasContext.fillRect(0, canvas.height-1, canvas.width, 1);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        var draw = ()=>{
          if (!userStatus.Mute && userStatus.Online) {
          requestAnimationFrame(draw);
          } else {
            requestAnimationFrame(()=>{
              canvasContext.clearRect(0,0,canvas.width,canvas.height-1);
            })
          }

          canvasContext.clearRect(0,0,canvas.width,canvas.height-1)

          const dataArray = new Uint8Array(bufferLength);
          analyser.getByteFrequencyData(dataArray);

          const barWidth = (WIDTH / bufferLength) * 2.5;
          let x = 0;
  
          for (let i = 0; i < bufferLength; i++) {
            const barHeight = dataArray[i];
            canvasContext.fillRect(
              WIDTH / 2 + x,
              HEIGHT - barHeight / 2,
              barWidth / 2,
              barHeight / 2
            );
            canvasContext.fillRect(
              WIDTH / 2 - x,
              HEIGHT - barHeight / 2,
              barWidth / 2 *-1,
              barHeight / 2
            );
  
            x += barWidth / 2;
          }

        }
        draw()
      }
      if (settings.self_spectogram)
      {
        doSpectogram()
      }

    }).catch((e) => {
      if (e.message == "Requested device not found") { MicAvailable(false) }
      console.error(e);                           // will show "foo"
    });
  }

  socket.on("send", async function (data) {
    if (!userStatus.Online) return;
    if (!CheckUrl(data)) {
      console.warn("url isn`t valid")
      return;
    };

    // Grab audio track via fetch() for convolver node
    try {
      const response = await fetch(data);
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength <= 0) {
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

      if (data[key].online) { userVisible(element.username, !element.mute); }
    }
  });
  socket.on("roomsChanged", (rooms) => {
    var addRoom = (id, name) => {
      $("#groupRooms").append(
        `<button type='button' class='btn btn-outline-secondary w-100 text-break' onclick='changeRoom("${id}")'>${String(name).replaceAll("<", "").replaceAll(">", "")}</button>`
      )
    }
    $("#groupRooms").html("")
    for (r in rooms) {
      if (rooms[r] === "System") {
        addRoom(r, lang[r])
      } else {
        addRoom(r, lang["room_author"].format(rooms[r]))
      }
    }
    addRoom("+", "+")
  })

  function TryCreateContext() {
    if (audioContext) { return }
    audioContext = new AudioContext()
    if (haveSink) { audioContext.setSinkId(settings.speaker); }
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



  function userVisible(name, mic, vis = true) {
    if (vis) {
      usersDiv.append(`<div class=\"col-md-3\"><div class=\"card\"><div class=\"card-body\">${String(name).replaceAll("<", "").replaceAll(">", "")}<span class="bi ${mic ? "bi-mic" : "bi-mic-mute"}"></span></div></div></div>`);
    } else {
      $(`#card-${name}`).remove()
    }
  }
  function usersReset() {
    usersDiv.html("")
  }
  function MicAvailable(isavailable) {
    if (settings.mic_disconnect_notification) {
      if (!isavailable) {
        mic_disconnected_notification = new Notification("js.maserplay.ru", { body: lang["Microphone disconnected"], icon: "/favicon.ico" })
      }
      else {
        mic_disconnected_notification.close()
      }

    }
    if (!isavailable) { userStatus.Mute = true; }
    $("#mute_btn").attr("disabled", !isavailable);
  }
  (() => { //load settings
    $("#disconnect_Notifications_check").prop('checked', settings.disconnect_notification)
    $("#Connect_Notifications_check").prop('checked', settings.connect_notification)
    $("#mic_disconnect_Notifications_check").prop('checked', settings.mic_disconnect_notification)
    $("#height_ping_Notifications_check").prop('checked', settings.height_ping_notification > 0);
    $("#Show_self_spectro").prop('checked', settings.self_spectogram)
    if (settings.height_ping_notification > 0) {
      $("#height_ping_Notifications_check").change()
      $("#height_ping_num").val(settings.height_ping_notification)
    }

    $("#rec_length_num").val(settings.record_length)
    $("#rec_length").val(settings.record_length)
    $("#Debug_mode").prop('checked', settings.debug)
  })()
  function saveSettings() {
    settings.mic_disconnect_notification = $("#mic_disconnect_Notifications_check").prop('checked')
    settings.connect_notification = $("#Connect_Notifications_check").prop('checked')
    settings.disconnect_notification = $("#disconnect_Notifications_check").prop('checked')
    if (!$("#height_ping_Notifications_check").prop('checked')) {
      settings.height_ping_notification = Number(-1);
    } else {
      settings.height_ping_notification = Number($("#height_ping_num").val());
    }
    settings.self_spectogram = $("#Show_self_spectro").prop('checked')

    settings.record_length = Number($("#rec_length_num").val());
    settings.debug = $("#mic_disconnect_Notifications_check").prop('checked')
    settings.mic = $('#microphone_select').val()?.trim() ?? "";
    if (haveSink) {
      settings.speaker = (($('#speaker_select').val()?.trim() === "default") ? "" : $('#speaker_select').val()?.trim()) ?? "";
      audioContext.setSinkId(settings.speaker);
    }
    localStorage.setItem("settings", JSON.stringify(settings));
    userStatus.Username = $('#username').val();
  }

  setInterval(() => {
    if (document.visibilityState === "hidden") //dontcheck ping if document non visible
    {
      return
    }

    const start = Date.now();

    socket.emit("ping", () => {
      const duration = Date.now() - start;
      ping_p.html(duration);
      if (settings.height_ping_notification > 0) {
        if (duration >= settings.height_ping_notification) {
          height_ping_notification = new Notification("js.maserplay.ru", { body: lang["Ping too height!"].format(duration), icon: "/favicon.ico" });
        } else {
          height_ping_notification.close();
        }
      }
    });
  }, 1000);
  $("#notification_toast_btn").on('click', function () {
    Notification.requestPermission(g => { 'granted' == g && new bootstrap.Toast('#notification_toast').hide() });
  })
  function clearSettings() {
    localStorage.removeItem('settings'); localStorage.removeItem('username'); location.reload();
  }
  $("#clearAll").on('click', function () {
    clearSettings()
  })
  $("#saveSettings").on('click', function () {
    saveSettings()
    $("#Settings").hide();
    $("#Main").show()
  })
  $("#closeSettings").on('click', function () {
    $("#Settings").hide();
    $("#Main").show()
  })
  $("#onl_btn").on('click', function () {
    TryCreateContext()
    userStatus.Online = !userStatus.Online;
  })
  $("#mute_btn").on('click', function () {
    userStatus.Mute = !userStatus.Mute;
  })
  $("#sett_btn").on('click', function () {
    TryCreateContext()
    $("#Settings").show();
    $("#Main").hide()
  })
  $("#AcceptWelcome").on('click', function () {
    TryCreateContext()
    userStatus.Username = $('#username_startup').val()
  })
  $("#speaker_select").on('focus', function () {
    getspe()
  })
  $("#microphone_select").on('focus', function () {
    getmic()
  })
  changeRoom = (to) => {
    socket.emit("changeRoom", to)
  }
  
  canvasContext.fillStyle = `rgba(${getComputedStyle(canvas).getPropertyValue("--bs-secondary-rgb")},1)`;
  canvasContext.fillRect(0, canvas.height-1, canvas.width, 1);
  $("#Loading").hide()
  $("#Main").show()
})()