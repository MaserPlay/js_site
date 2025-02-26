// const { BroadcastOperator } = require("socket.io");
import { DefaultEventsMap, BroadcastOperator, Socket } from 'socket.io';
// const socketsStatus = socket_io.BroadcastOperator

// const io = require("../index").io;
import * as index from '../index';
const io = index.default.io

class User {
  username = "AnUnnamedUser";
  mute = false;
  online = false;
  constructor(name?: string) {
    this.username = name ?? "AnUnnamedUser";
  }
  fromJson(json: string) {
    return Object.assign(this, json)
  }
}
class Room {
  owner: User;
  users: Map<string, User>;

  constructor(owner: User, socketId: string) {
    this.owner = owner;
    this.users = new Map([[socketId, owner]]);
  }

  getUser(socketId: string): User {
    return this.users.get(socketId)!;
  }

  deleteUser(socketId: string): void {
    this.users.delete(socketId);
  }

  addUser(user: User, socketId: string): void {
    this.users.set(socketId, user);
  }
}

const systemUser = new User("System")
const socketsStatus = new Map([["main-room", new Room(systemUser, "system")]])
// ^\/voice_chat\/room\/\S+$
io.on("connection", function (socket) {
  var user = new User();
  var room = "main-room";
  const socketId = socket.id;

  console.log("[voice] connect with id:", socketId);

  socket.join(room);
  socketsStatus.get(room)!.addUser(user, socketId);

  emitRoomsChanged(true)


  socket.on("voice", function (data) {
    if (!CheckUrl(data)) { // if output url dont correct
      console.warn("url isn`t valid")
      return;
    };

    if (!socketsStatus.get(room)) {
      console.warn("socketsStatus.get(room) === null")
      return;
    }
    for (const id of socketsStatus.get(room)!.users.keys()) {

      if (id != socketId && socketsStatus.get(room)!.getUser(id).online)
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


  socket.on("disconnect", function (reason) {
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
    socketsStatus.get(room)!.deleteUser(socketId);
    if (room !== "main-room") {
      if ((socketsStatus.get(room)!.users).size <= 0) {
        socketsStatus.delete(room)
        emitRoomsChanged();
      }
    }
    if (socketsStatus.has(room) && user.online) { emitUsersUpdate() }
  }
  function JoinRoom(name: string) {
    if (!socketsStatus.has(name)) return;
    socket.leave(room)
    room = name;
    socket.join(room);
    socketsStatus.get(room)!.addUser(user, socketId);
    emitUsersUpdate()
  }


  socket.on("ping", (callback) => {
    callback();
  });
  function emitUsersUpdate() {
    if (!socketsStatus.get(room)) {
      console.warn("socketsStatus.get(room) === null")
      return;
    }
    io.in(room).emit("usersUpdate", Object.fromEntries(Object.entries(Object.fromEntries(socketsStatus.get(room)!.users)).filter(([a, b]) => b.online === true)));
  }
  function emitRoomsChanged(only_socket?: boolean) {

    function emitRoomsChangedtosocket(socket: any, socketUserID: string) {
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
      socketsStatus.forEach((room) => {
        for (const socket of room.users) {
          emitRoomsChangedtosocket(io.to(socket[0]), socket[0])
        }
      })
    }
  }
});

function CheckUrl(string: string) {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return !url.protocol || url.protocol == "data:";
}

function escapeHtml(str: string) {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#x60;');
}