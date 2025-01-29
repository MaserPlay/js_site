const faker = require('@faker-js/faker').faker;
const assert = require("assert");
const io_client = require("socket.io-client");
 

describe ("voice-chat test", function () { 
    describe ("test Server (by client)", function () { 
        let app, ioSocket, ioSocket2
        before(function (done) { 
            app = require("../index");
            const socketio_addr = `http://localhost:${app.Server.address().port}`
            console.log(`connecting to socketio to ${socketio_addr}`)
            ioSocket = io_client(socketio_addr, {forceNew: true});
            ioSocket2 = io_client(socketio_addr, {forceNew: true});
            ioSocket.on("connect_error", (err) => {
                assert.fail(`ioSocket connect error: ${err}`);
            });
            ioSocket2.on("connect_error", (err) => {
                assert.fail(`ioSocket2 connect error: ${err}`);
            });
            var connections = 0
            function addConnection() {
                connections++;
                if (connections>=2)
                {
                    done()
                }
            }
            ioSocket.on("connect", addConnection);
            ioSocket2.on("connect", addConnection);
        })

        after(function () { 
            app.Server.close()
            ioSocket.close()
            ioSocket2.close()
        })
        it("connected",()=>{
            assert(ioSocket.connected)
            assert(ioSocket2.connected)
        })
        it("userInformation has all the properties", function(done){
            this.timeout(5000)
            var tempJson = JSON.stringify({username: faker.finance.accountName(), online: true, mute: faker.datatype.boolean()})
            var tempJson1 = JSON.stringify({username: faker.finance.accountName(), online: true, mute: faker.datatype.boolean()})

            var callCount = 0
            ioSocket.on("usersUpdate", (t)=>{
                    console.log("Received usersUpdate:", t)
                    assert(Object.values(t).every(entry => 'username' in entry), `${JSON.stringify(t)} doesnt have 'username' in all properties (Object.values(t).every(entry => 'username' in entry))`)
                    switch (callCount)
                    {
                        case 0:
                            break;
                        case 1:
                            assert.strictEqual(JSON.stringify(t), tempJson1)
                            break;
                        case 2:
                            assert.strictEqual(JSON.stringify(t), tempJson)
                            assert.strictEqual(JSON.stringify(t), tempJson1)
                            done(); // Завершаем тест
                            break;
                    }
                    callCount++;
                }
            )
            ioSocket.emit("userInformation", tempJson1)
            ioSocket2.emit("userInformation", tempJson)
        });
    })
})


