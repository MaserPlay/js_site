const faker = require('@faker-js/faker').faker;
const assert = require("assert");
const io_client = require("socket.io-client");
 

describe ("voice-chat test", function () { 
    describe ("test Server (by client)", function () { 
        let app
        let ioSocket
        let ioSocket2
        before(function () { 
            app = require("../index");
            ioSocket = io_client(`http://localhost:${app.Server.address().port}`);
            ioSocket2 = io_client(`http://localhost:${app.Server.address().port}`);
            ioSocket.on("connect_error", (err) => {
                assert.fail(`ioSocket connect error: ${err.message}`);
            });
            ioSocket2.on("connect_error", (err) => {
                assert.fail(`ioSocket2 connect error: ${err.message}`);
            });
        })

        after(function () { 
            app.Server.close()
            ioSocket.close()
            ioSocket2.close()
        })

        it("Change nick and status", function(done){
            var tempJson = JSON.stringify({username: faker.finance.accountName(), online: true, mute: faker.datatype.boolean()})
            ioSocket.emit("userInformation", JSON.stringify({username: faker.finance.accountName(), online: true, mute: faker.datatype.boolean()}))

            ioSocket.on("usersUpdate", (t)=>{
                    console.log("Received usersUpdate:", t)
                    assert.strictEqual(JSON.stringify(t), tempJson)
                    done(); // Завершаем тест
                }
            )

            ioSocket2.emit("userInformation", tempJson)
        });
    })
})


