const httpServer = require("../index").httpServer
const io = require("socket.io")(httpServer);

class User {
  mute = false;
  username = "AnUnnamedUser";
  online = false;
  /**
  * @param {string} name
  */
  constructor(name){
    this.username = name
  }
}
class Room {
  /**
  * @param {User} owner
  * @param {string} socketId
  */
  constructor(owner, socketId) {
      this.owner = owner;
      this.users = new Map([[socketId, owner]]);
  }

  getUser(socketId) {
    return this.users.get(socketId)
  }
  deleteUser(socketId){
    this.users.delete(socketId);
  }
  addUser(user, socketId){
    this.users.set(socketId, user)
  }
}

const systemUser = new User("System")
const socketsStatus = new Map([["main-room", new Room(systemUser, "system")]])
// ^\/voice_chat\/room\/\S+$
io.on("connection", function (socket) {
    var user = new User();
    console.log("[voice] connect with id:", socket.id);
    var room;
    const socketId = socket.id;
    JoinRoom("main-room")
    emitRoomsChanged(true)
    
  
    socket.on("voice", function (data) {
      if (!CheckUrl(data)) { // output url dont correct
        console.warn("url isn`t valid")
        return;
      };
  
      for (id of socketsStatus.get(room).users.keys()) {
  
        if (id != socketId && socketsStatus.get(room).getUser(id).online)
          socket.broadcast.to(id).emit("send", data);
      }
  
    });
  
    socket.on("userInformation", function (data) {
      data.username = data.username.replace("<", "{").replace(">", "}")
      user = data
      socketsStatus.get(room).addUser(user, socketId);
      emitUsersUpdate()
    });
  
  
    socket.on("disconnect", function () {
      leaveRoom()
    });

    socket.on("changeRoom", (name)=>{
      if (name === "+")
      {
        leaveRoom()
        var nroom = String(socketsStatus.size);
        socketsStatus.set(nroom, new Room(user, socketId))
        JoinRoom(nroom)
        emitRoomsChanged();
      } else {
        if (socketsStatus.has(name))
        {
          leaveRoom()
          JoinRoom(name)
        }
      }
    })

    function leaveRoom() {
      if (!socketsStatus.has(room)) return;
      socketsStatus.get(room).deleteUser(socketId);
      if (room !== "main-room"){
        if (Object.keys(socketsStatus.get(room).users).length <= 0){
          socketsStatus.delete(room)
          emitRoomsChanged();
        }
      }
      if (socketsStatus.has(room))
        {emitUsersUpdate()}
    }
    function JoinRoom(name) {
      if (!socketsStatus.has(name)) return;
      socket.leave(room)
      room = name;
      socket.join(room);
      socketsStatus.get(room).addUser(user, socketId);   
      emitUsersUpdate()
    }
  
    
    socket.on("ping", (callback) => {
      callback();
    });
    function emitUsersUpdate(){
      io.in(room).emit("usersUpdate",Object.fromEntries(socketsStatus.get(room).users));
    }
    function emitRoomsChanged(only_socket){
      // for (var rom of socketsStatus.values()){
      //   for (var u of rom.users){
      //     socket.broadcast.to(u[0]).emit("roomsChanged", u[1]);
      //   }
      // }
      var dest = io
      if (only_socket)
      {
        dest = socket
      }
      dest.emit("roomsChanged", Object.fromEntries(Array.from(socketsStatus.entries()).map(([key, value]) => [key, value.owner.username])));
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
