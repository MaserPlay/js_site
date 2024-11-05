const { BroadcastOperator } = require("socket.io");

const httpServer = require("../index").httpServer
const io = require("socket.io")(httpServer);

class User {
  username = "AnUnnamedUser";
  mute = false;
  online = false;
  /**
  * @param {string} name
  */
  constructor(name) {
    this.username = name;
  }
  fromJson(json) {
    return Object.assign(this, json)
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
  deleteUser(socketId) {
    this.users.delete(socketId);
  }
  addUser(user, socketId) {
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
    if (!CheckUrl(data)) { // if output url dont correct
      console.warn("url isn`t valid")
      return;
    };

    if (!socketsStatus.get(room))
    {
      console.warn("socketsStatus.get(room) === null")
      return;
    }
    for (id of socketsStatus.get(room).users.keys()) {

      if (id != socketId && socketsStatus.get(room).getUser(id).online)
        socket.broadcast.to(id).emit("send", data);
    }

  });

  socket.on("userInformation", function (data) {
    data.username = String(data.username)

    var finalUsername = escapeHtml(String(data.username)).substring(0, 100);

    if (data.username !== finalUsername) {
      data.username = finalUsername
      socket.emit("ChangeNickname", data.username)
    }
    user = user.fromJson(data)
    emitUsersUpdate()
  });


  socket.on("disconnect", function () {
    leaveRoom()
  });

  socket.on("changeRoom", (name) => {
    if (name == room) {

    } else if (name === "+") {
      leaveRoom()
      var nroom = String(socketsStatus.size);
      socketsStatus.set(nroom, new Room(user, socketId))
      JoinRoom(nroom)
      emitRoomsChanged();
    } else {
      if (socketsStatus.has(name)) {
        leaveRoom()
        JoinRoom(name)
        emitRoomsChanged(true);
      }
    }
  })

  function leaveRoom() {
    if (!socketsStatus.has(room)) return;
    socketsStatus.get(room).deleteUser(socketId);
    if (room !== "main-room") {
      if ((socketsStatus.get(room).users).size <= 0) {
        socketsStatus.delete(room)
        emitRoomsChanged();
      }
    }
    if (socketsStatus.has(room)) { emitUsersUpdate() }
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
  function emitUsersUpdate() {
    if (!socketsStatus.get(room))
    {
      console.warn("socketsStatus.get(room) === null")
      return;
    }
    io.in(room).emit("usersUpdate", Object.fromEntries(socketsStatus.get(room).users));
  }
  /**
   * @param {boolean} only_socket 
   */
  function emitRoomsChanged(only_socket) {

    /**
     * @param {BroadcastOperator} socket 
     * @param {string} socketUserID 
     */
    function emitRoomsChangedtosocket(socket, socketUserID) {
      socket.emit("roomsChanged", Object.fromEntries(Array.from(socketsStatus.entries()).map(([key, value]) => 
        [
          key, {
            "owner": value.owner.username,
            "is_we_here": !!value.getUser(socketUserID)
          }
        ]
      )));
    }

    if (only_socket) {
      emitRoomsChangedtosocket(socket, socketId)
    } else {
      socketsStatus.forEach((room)=>{
        for (const socket of room.users) {
          emitRoomsChangedtosocket(io.to(socket[0]), socket[0])
        }
      })
    }
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

function escapeHtml(str) {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#x60;');
}