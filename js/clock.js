/* global THREE:false, requestAnimationFrame:false, Promise:false, HMDVRDevice:false, PositionSensorVRDevice:false, moment:false, navigator:false, document:false */

'use strict';

var container;
var context;

var camera, scene;
var vrEffect, renderer;
var vrControl, monoControl;
var modeVR = false;

function addAxisGrid() {
    var helper = new THREE.Object3D();
    
    // X軸:赤, Y軸:緑, Z軸:青
    var axis = new THREE.AxisHelper(20);
    helper.add(axis);

    // GridHelper
    var grid = new THREE.GridHelper(20, 1);
    helper.add(grid);
    
    return helper;
}

function vrDetect() {
    var hmdDevice, positionDevice;
    return new Promise(function (resolve, reject) {
        if (navigator.getVRDevices) {
            navigator.getVRDevices().then(function (devices) {

                //console.log(JSON.stringify(devices));

                for (var i = 0; i < devices.length; ++i) {
                    if (devices[i] instanceof HMDVRDevice && !hmdDevice) {
                        hmdDevice = devices[i];
                        console.log('found head mounted display device');
                        console.log('hmdDevice(devices[' + i + ']', hmdDevice);
                    }

                    if (devices[i] instanceof PositionSensorVRDevice &&
                        devices[i].hardwareUnitId === hmdDevice.hardwareUnitId && !positionDevice) {
                        positionDevice = devices[i];
                        console.log('found motion tracking devices');
                        console.log('positionDevice(devices[' + i + ']', positionDevice);
                        //break;
                    }
                    //console.log(JSON.stringify(devices[i]));
                }

                if (hmdDevice && positionDevice) {
                    resolve();
                    return;
                }
                reject('no VR devices found!');
            });
        } else {
            reject('no VR implementation found!');
        }
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    if (modeVR) {
        vrEffect.setSize(window.innerWidth, window.innerHeight);
    } else {
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

function init() {
    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xffffff);

    // VR stereo rendering
    vrEffect = new THREE.VREffect(renderer);
    vrEffect.setSize(window.innerWidth, window.innerHeight);
    
    container = document.getElementById('vrContainer');
    container.appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 50);
    camera.position.z = 5;
    scene.add(camera);

    //scene.add(addAxisGrid());

    var sphereTexture = THREE.ImageUtils.loadTexture('images/earth.png');
    sphereTexture.minFilter = THREE.LinearFilter;
    sphereTexture.magFilter = THREE.LinearFilter;
    
    var sphereGeometry = new THREE.SphereGeometry(1, 32, 16);
    var frontMaterial = new THREE.MeshBasicMaterial({
        side: THREE.BackSide,
        color: 0x888888,
        transparent: true,
        map: sphereTexture
    });
    var frontSphere = new THREE.Mesh(sphereGeometry, frontMaterial);
    var backMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        map: sphereTexture
    });
    var backSphere = new THREE.Mesh(sphereGeometry, backMaterial);
    var innerSphere = new THREE.Object3D();
    innerSphere.add(frontSphere);
    innerSphere.add(backSphere);
    var outerSphere = new THREE.Object3D();
    outerSphere.add(innerSphere);
    outerSphere.rotation.z = -23.4 * Math.PI / 180;
    scene.add(outerSphere);

    var canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 100;
    context = canvas.getContext('2d');
    context.font = 'Bold 100px Arial';

    var counterTexture = new THREE.Texture(canvas);
    counterTexture.minFilter = THREE.LinearFilter;
    counterTexture.magFilter = THREE.LinearFilter;

    var counterGeometry = new THREE.PlaneBufferGeometry(1.8, 0.3);
    var counterMaterial = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        map: counterTexture
    });
    var counter = new THREE.Mesh(counterGeometry, counterMaterial);
    counter.position.set(0, 0, 0.001);

    var counterBgMaterial = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        color: 0x888888,
        transparent: true,
        opacity: 0.5,
    });
    var counterBg = new THREE.Mesh(counterGeometry, counterBgMaterial);

    var time = new THREE.Object3D();
    time.add(counterBg);
    time.add(counter);
    time.position.set(0, 0, 1);
    scene.add(time);
    
    var baseTime = new Date();
    
    // for not VR
    monoControl = new THREE.OrbitControls(camera, renderer.domElement);
    // for VR
    vrControl = new THREE.VRFlyControls(camera);

    // enterVR button
    var enterVr = document.getElementById('enterVR');
    // when VR is not detected
    var getVr = document.getElementById('getVR');

    vrDetect().then(function () {
        // vr detected
        getVr.classList.add('display-none');
    }, function () {
        // displays when VR is not detected
        enterVr.classList.add('display-none');
        getVr.classList.remove('display-none');
    });

    window.addEventListener('resize', onWindowResize, false);
    
    // VRボタンクリックでfull-screen VR mode
    enterVr.addEventListener('click', function () {
        modeVR = true;
        vrEffect.setFullScreen(true);
    }, false);

    // 画面ダブルクリックでfull-screen VR mode
    window.addEventListener('dblclick', function () {
        modeVR = true;
        vrEffect.setFullScreen(true);
    }, false);

    // full-screen VR modeからの復帰時の処理
    document.addEventListener('mozfullscreenchange', function () {
        if (document.mozFullScreenElement === null) {
            modeVR = false;
        }
    });

    function animate() {
        // keep looping
        requestAnimationFrame(animate);

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#000000';
        context.fillText(moment().format('HH:mm:ss:SS'), 20, 85);
        counterTexture.needsUpdate = true;
        innerSphere.rotation.y = 0.3 * (new Date() - baseTime) / 5000;
        
        if (modeVR) {
            // Update VR headset position and apply to camera.
            vrControl.update(0.05);
            // Render the scene through the VREffect.
            vrEffect.render(scene, camera);
        } else {
            monoControl.update();
            renderer.render(scene, camera);
        }
    }

    requestAnimationFrame(animate);
}

init();
