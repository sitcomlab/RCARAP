/**
 * Created by pglah on 30.04.2018.
 */
var peer = new Peer({
    host: "localhost",
    port: 8080,
    path: '/peerjs',
    debug:3

});
/**
document.addEventListener("DOMContentLoaded", function(event) {
    peer.on('open', function () {
        document.getElementById("peer-id-label").innerHTML = peer.id;
    });
    document.getElementById("callButton").addEventListener("click", callPeer);
    /*peer.on('connection', function (connection) {
        conn = connection;
        peer_id = connection.peer;

        // Use the handleMessage to callback when a message comes in
        conn.on('data', handleMessage);

        // Hide peer_id field and set the incoming peer id as value
        document.getElementById("peer_id").className += " hidden";
        document.getElementById("peer_id").value = peer_id;
        document.getElementById("connected_peer").innerHTML = connection.metadata.username;
    });*/
    //peer1.call(PEER_2_ID, mediaStream);
/**
     function callPeer(){
        var callId = document.getElementById("callIdInput").value;
        console.log("try to reach peer with id" + callId);
        var peerjsConnection = peer.connect(callId);
    };
    peer.on('connection', function(peerjsConnection) {
        peerjsConnection.on('open', function() {
            console.log("opened");
            peerjsConnection.on('data', function (data) {
                peerjsConnection.send('Hello');
                console.log('Received', data);
            });
            peerjsConnection.send('Hello');
        })});
    peer.on('error', function(err){
        alert("An error ocurred with peer: " + err);
        console.error(err);
    });
    /*peer.on('call', function (call) {
        console.log("received call");
    });

}, false);
*/
peer.on('open', function () {
    document.getElementById("pid").innerHTML = peer.id;
});

var conn;
// Connect to PeerJS, have server assign an ID instead of providing one
peer.on('open', function () {
    document.getElementById("pid").innerHTML = peer.id;
});
// Await connections from others
peer.on('connection', callPeer);
function callPeer(connection) {
    $('#chat_area').show();
    conn = connection;
    $('#messages').empty().append('ID of connection is: ' + conn.peer);
    conn.on('data', function(data){
        $('#messages').append('<br>' + conn.peer + ':<br>' + data);
    });
    conn.on('close', function(err){ alert(conn.peer + ' has left the chat.') });
}
$(document).ready(function() {
    // Conect to a peer
    $('#connect').click(function(){
        var connection = peer.connect($('#peerConnect').val());
        connection.on('open', function(){
            callPeer(connection);
        });
        connection.on('error', function(err){ alert(err) });
    });
    // Send a chat message
    $('#send').click(function(){
        var msg = $('#text').val();
        conn.send(msg);
        $('#messages').append('<br>You:<br>' + msg);
        $('#text').val('');
    });
});

