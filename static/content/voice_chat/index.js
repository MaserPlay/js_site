const userStatus = {
    mute: false,
    username: localStorage.getItem("username") ?? "user#" + Math.floor(Math.random() * 999999),
    online: false,
  };
  if (localStorage.getItem("username") == null)
  {
    $("#username_startup").val(userStatus.username)
    new bootstrap.Modal('#startup_select').show()
  }
  var disconnected_toast = new bootstrap.Toast('#disconnected_toast')
  var disconnected_notification = {close: ()=>{}};
  
  const usernameInput = document.getElementById("username");
  const usernameLabel = document.getElementById("username-label");
  const usernameDiv = document.getElementById("username-div");
  const usersDiv = $("#users");
  
  usernameInput.value = userStatus.username;
  usernameLabel.innerText = userStatus.username;
    
  
  var socket = io("ws://" + document.location.host);
  socket.on("connect", () => {
    disconnected_toast.hide(); disconnected_notification.close(); socket.emit("userInformation", userStatus);
  });
  
  socket.on("connect_error", (err) => {
    console.error(e);
  });
  
  socket.on("disconnect", (reason) => {
    disconnected_toast.show();disconnected_notification = new Notification("js.maserplay.ru", { body: `Disconected.`, icon: "/favicon.ico" });
  });
  
  
  function mainFunction(time) {
  
  
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      var madiaRecorder = new MediaRecorder(stream);
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
  
        madiaRecorder.start();
  
  
        setTimeout(function () {
          madiaRecorder.stop();
        }, time);
      });
  
      setTimeout(function () {
        madiaRecorder.stop();
      }, time);
    }).catch((err) => {
      console.log(err);                           // will show "foo"
  });
  
  
    socket.on("send", function (data) {
      var audio = new Audio(data);
      audio.play();
    });
  
    socket.on("usersUpdate", function (data) {
      usersReset();
      for (const key in data) {
        if (!Object.hasOwnProperty.call(data, key)) continue;
  
        const element = data[key];
        userVisible(element.username, true);  
      }
    });
  
  }
  
  usernameLabel.onclick = function () {
    usernameDiv.style.display = "block";
    usernameLabel.style.display = "none";
  }
  
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
    mainFunction(1000);
  }
  
  function toggleMute(e) {
    userStatus.mute = !userStatus.mute;
  
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
  
  
  
  function userVisible(name, vis){
    if (vis){
      usersDiv.html(usersDiv.html() + `<div id=\"card-${name}\" class=\"col-md-3\"><div class=\"card\"><div class=\"card-body\">${name}</div></div></div>`);
    } else {
      $(`#card-${name}`).remove()
    }
  }
  function usersReset(){
    usersDiv.html("")
  }