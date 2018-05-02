/**
 * Created by pglah on 30.04.2018.
 */
var peer = new Peer({
    host: "localhost",
    port: 8080,
    path: '/peerjs',
    debug:3

});

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

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

peer.on('open', function(){
    $('#my-id').text(peer.id);
});

peer.on('call', function(call){
    // Answer the call automatically (instead of prompting user) for demo purposes
    call.answer(window.localStream);
    step3(call);
});
peer.on('error', function(err){
    alert(err.message);
    // Return to step 2 if error occurs
    step2();
});
// Click handlers setup
$(function(){
    $('#make-call').click(function(){
        // Initiate a call!
        var call = peer.call($('#callto-id').val(), window.localStream);
        step3(call);
    });
    $('#end-call').click(function(){
        window.existingCall.close();
        step2();
    });
    // Retry if getUserMedia fails
    $('#step1-retry').click(function(){
        $('#step1-error').hide();
        step1();
    });
    // Get things started
    step1();
});
function step1 () {
    // Get audio/video stream
    navigator.getUserMedia({audio: true, video: true}, function(stream){
        // Set your video displays
        $('#my-video').prop('src', URL.createObjectURL(stream));
        window.localStream = stream;
        step2();
    }, function(){ $('#step1-error').show(); });
}
function step2 () {
    $('#step1, #step3').hide();
    $('#step2').show();
}
function step3 (call) {
    // Hang up on an existing call if present
    if (window.existingCall) {
        window.existingCall.close();
    }
    // Wait for stream on the call, then set peer video display
    call.on('stream', function(stream){
        $('#their-video').prop('src', URL.createObjectURL(stream));
    });
    // UI stuff
    window.existingCall = call;
    $('#their-id').text(call.peer);
    call.on('close', step2);
    $('#step1, #step2').hide();
    $('#step3').show();
}

