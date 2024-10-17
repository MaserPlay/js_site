const httpServer = require("../index").httpServer
const io = require("socket.io")(httpServer);
//To holding users information 
const socketsStatus = {"main-room":{}};
// ^\/voice_chat\/room\/\S+$
io.on("connection", function (socket) {
    console.log("[voice] connect with id:", socket.id);
    var room;
    const socketId = socket.id;
    JoinRoom("main-room")
    
  
    socket.on("voice", function (data) {
  
      // var newData = data.split(";");
      // newData[0] = "data:audio/ogg;";
      // newData = newData[0] + newData[1];
      var newData = data
  
      for (const id in socketsStatus[room]) {
  
        if (id != socketId && socketsStatus[room][id].online)
          socket.broadcast.to(id).emit("send", newData);
      }
  
    });
    // socket.on("voiceRaw", function (data) {
  
    //   for (const id in socketsStatus[room]) {
  
    //     if (id != socketId && socketsStatus[room][id].online)
    //       socket.broadcast.to(id).emit("send", data);
    //   }
  
    // });
  
    socket.on("userInformation", function (data) {
      data.username.replace("<", "{").replace(">", "}")
      if (!data.online)
      {
        delete socketsStatus[room][socketId];
      } else {
        socketsStatus[room][socketId] = data;
      }
      io.in(room).emit("usersUpdate",socketsStatus[room]);
    });
  
  
    socket.on("disconnect", function () {
      leaveRoom()
    });

    socket.on("changeRoom", (name, callback)=>{
      if (name === "+")
      {
        leaveRoom()
        var nroom = String(Object.keys(socketsStatus).length);
        socketsStatus[nroom] = {}
        JoinRoom(nroom)
        io.emit("roomsChanged", Object.keys(socketsStatus));
      } else {
        leaveRoom()
        JoinRoom(name)
      }
      callback({
        status: "ok"
      });
    })

    function leaveRoom() {
      delete socketsStatus[room][socketId];
      if (room !== "main-room"){
        if (socketsStatus[room].length <= 0){
          delete socketsStatus[room]
          io.emit("roomsChanged", Object.keys(socketsStatus));
        }
      }
      io.in(room).emit("usersUpdate",socketsStatus[room]);
    }
    function JoinRoom(name) {
      socket.leave(room)
      room = name;
      socket.join(room);
      socketsStatus[room][socket.id] = {online: false};       
      io.in(room).emit("usersUpdate",socketsStatus[room]);      
    }
  
    
    socket.on("ping", (callback) => {
      callback();
    });
  });