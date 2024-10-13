// const { httpServer } = require("httpServer")
// const io = require("socket.io")(httpServer);
// //To holding users information 
// const socketsStatus = {};

// io.on("connection", function (socket) {
//     const socketId = socket.id;
//     socketsStatus[socket.id] = {};
  
  
//     console.log("connect");
  
//     socket.on("voice", function (data) {
  
//       var newData = data.split(";");
//       newData[0] = "data:audio/ogg;";
//       newData = newData[0] + newData[1];
  
//       for (const id in socketsStatus) {
  
//         if (id != socketId && !socketsStatus[id].mute && socketsStatus[id].online)
//           socket.broadcast.to(id).emit("send", newData);
//       }
  
//     });
  
//     socket.on("userInformation", function (data) {
//       socketsStatus[socketId] = data;
  
//       io.sockets.emit("usersUpdate",socketsStatus);
//     });
  
  
//     socket.on("disconnect", function () {
//       delete socketsStatus[socketId];
//     });
  
//   });