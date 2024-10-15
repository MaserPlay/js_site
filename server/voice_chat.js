const httpServer = require("../index").httpServer
const io = require("socket.io")(httpServer);
//To holding users information 
const socketsStatus = {};

io.on("connection", function (socket) {
    console.log("[voice] connect with id:", socket.id);

    const socketId = socket.id;
    socketsStatus[socket.id] = {online: false}; 
  
    io.sockets.emit("usersUpdate",socketsStatus);
  
    socket.on("voice", function (data) {
  
      var newData = data.split(";");
      newData[0] = "data:audio/ogg;";
      newData = newData[0] + newData[1];
  
      for (const id in socketsStatus) {
  
        if (id != socketId && socketsStatus[id].online)
          socket.broadcast.to(id).emit("send", newData);
      }
  
    });
  
    socket.on("userInformation", function (data) {
      if (!data.online)
      {
        delete socketsStatus[socketId];
      } else {
        socketsStatus[socketId] = data;
      }
      
      // for (const id in socketsStatus) {  
      //   socket.broadcast.to(id).emit("usersUpdate", socketsStatus);
      // }
      io.sockets.emit("usersUpdate",socketsStatus);
    });
  
  
    socket.on("disconnect", function () {
      delete socketsStatus[socketId];
      io.sockets.emit("usersUpdate",socketsStatus);
    });
    socket.on("ping", (callback) => {
      callback();
    });
  
  });