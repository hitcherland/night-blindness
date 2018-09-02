var loadMonitorRoom = function() {
    // Generate the BABYLON 3D engine
    var engine = new BABYLON.Engine(canvas, true);
    engine.isPointerLock = true;

    // Watch for browser/canvas resize events
    window.addEventListener("resize", function () {
            engine.resize();
    });

    BABYLON.SceneLoader.Load(
        "scenes/monitor_room/", "monitor.babylon", engine,
        function (playerScene) {
            playerScene.executeWhenReady( function() { 
                var good_sound = new BABYLON.Sound("Music", "audio/shortgood.mp3", playerScene, null, { loop: false, autoplay: false });
                var bad_sound = new BABYLON.Sound("Music", "audio/shortbad.mp3", playerScene, null, { loop: false, autoplay: false });

                var music = new BABYLON.Sound("Music", "audio/background.mp3", playerScene, null, { loop: true, autoplay: true });

                playerScene.activeCamera.attachControl(canvas);
                playerScene.activeCamera.multiTouchPanAndZoom = false;

                // Clamp the camera rotation
                var x = playerScene.activeCamera.rotation.x;
                var y = playerScene.activeCamera.rotation.y;
                var z = playerScene.activeCamera.rotation.z;

                playerScene.registerBeforeRender(function () {
                    playerScene.activeCamera.rotation = new BABYLON.Vector3(
                        playerScene.activeCamera.rotation
                            .x.clamp( x - 0.2, x + 0.2 ),
                        playerScene.activeCamera.rotation
                            .y.clamp( y - Math.PI / 4, y + Math.PI / 4 ),
                        playerScene.activeCamera.rotation
                            .z.clamp( z - Math.PI / 4, z + Math.PI / 4 ),
            
                    )
                });


                // Set up keyboard input
                var inputMap = {};

                playerScene.actionManager =
                    new BABYLON.ActionManager(playerScene);
                playerScene.actionManager.registerAction(
                    new BABYLON.ExecuteCodeAction(
                        BABYLON.ActionManager.OnKeyDownTrigger,
                        function (evt) {
                            inputMap[evt.sourceEvent.key] =
                                evt.sourceEvent.type == "keydown";
                        }
                    )
                );
                playerScene.actionManager.registerAction(
                    new BABYLON.ExecuteCodeAction(
                        BABYLON.ActionManager.OnKeyUpTrigger,
                        function (evt) {
                            inputMap[evt.sourceEvent.key] =
                                evt.sourceEvent.type == "keydown";
                        }
                    )
                );

                var loadedLevelScene;
                var monitor_textures;
                var originalCarPosition;
                var originalCarOrientation;
                var audio_playing = false;

                // Load the level
                loadLevel(
                    "simple",
                    engine,
                    inputMap,
                    function(levelScene) {
                        loadedLevelScene = levelScene;
                        monitor_textures = setupMonitors(
                            playerScene, levelScene
                        );

                        var car = levelScene.getMeshByName("Car");
                        originalCarPosition = car.position;
                        originalCarOrientation = car.rotationQuaternion;

                        engine.runRenderLoop(function () { 
                            try{
                                if(loadedLevelScene) {
                                    loadedLevelScene.render();
                                }
                                playerScene.render();
                            } catch (e ) {
                                console.log( "wait" );
                            }
                        });
                    },
                    function() {
                        if( !audio_playing ) {
                            console.log("You hacked good!");
                            audio_playing = true;
                            good_sound.play() 
                            good_sound.onended = function() {
                                if(loadedLevelScene) {
                                    audio_playing = false;
                                    var car = loadedLevelScene.getMeshByName("Car");
                                    car.position = originalCarPosition;
                                    car.rotationQuaternion = originalCarOrientation;
                                }
                            }
                        }
                    },
                    function() {
                        if( !audio_playing ) {
                            console.log("Oh no, you got caught!");
                            audio_playing = true;
                            bad_sound.play() 
                            bad_sound.onended = function() {
                                if(loadedLevelScene) {
                                    audio_playing = false;
                                    var car = loadedLevelScene.getMeshByName("Car");
                                    car.position = originalCarPosition;
                                    car.rotationQuaternion = originalCarOrientation;
                                }
                            }
                        }
                    }
                );

            });            
        }
    );
}

var makeMonitorTexture = function( levelScene, camera ) {
BABYLON.Effect.ShadersStore["noiseFragmentShader"] = `
#ifdef GL_ES
precision highp float;
#endif

// Samplers
varying vec2 vUV;
uniform sampler2D textureSampler;

// Parameters
uniform vec2 screenSize;
uniform float time;
uniform float scaling;

float random( vec2 p ) {
    vec2 K1 = vec2(
        23.14069263277926, // e^pi (Gelfond's constant)
         2.665144142690225 // 2^sqrt(2) (Gelfondâ€“Schneider constant)
    );
    return mod( 1664525.0 * time * ( p.x  * 12.0 + p.y ) + 1013904223.0, 4294967296.0 )/  4294967296.0;
}

void main(void) 
{
    vec4 baseColor = texture2D(textureSampler, vUV);
    float rand = random( floor( vUV * scaling ) );
    baseColor = ( 4.0 * baseColor + vec4( rand,rand,rand, 1 ) ) / 5.0;
    baseColor.a = 1.0;

    gl_FragColor = baseColor;
}`

    var diff = new BABYLON.RenderTargetTexture(
        ".renderTexture", 1024, levelScene, true
    );
    diff.samples = 16;
    diff.anisotropicFilteringLevel = 0;
    diff.lodGenerationScale = 1.0;
    diff.renderList = null;
    diff.uAng = 0;//Math.PI / 2;
    diff.vAng = 0; //Math.PI / 2;
    diff.wAng = -Math.PI / 2;
    diff.wrapU = 0;
    diff.wrapV = 0;
    return diff;

}

var makeMonitor = function( monitor, playerScene, levelScene, remoteCamera ) {
    var mat = new BABYLON.StandardMaterial(
        monitor.name + ".material", playerScene
    );
    var diff = makeMonitorTexture( levelScene, remoteCamera );
    monitor.material = mat
    mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    mat.diffuseTexture = diff;
    remoteCamera.customRenderTargets.push( mat.diffuseTexture );

    var text = monitor.clone( "text" );
    textmat = new BABYLON.StandardMaterial(
        monitor.name + ".text.material", playerScene
    );

    var textTexture = new BABYLON.DynamicTexture( monitor.name + ".text.texture", 512, playerScene, true);
    text.material = textmat;
    textmat.diffuseTexture = textTexture;
    textTexture.drawText( remoteCamera.name, 10, 20, "bold 20px monospace", "white", "#0000AA00");
    textTexture.wAng = -Math.PI / 2;
    textmat.specularColor = new BABYLON.Color4( 0, 0, 0, 0 );
    textmat.specularColor = new BABYLON.Color4( 0, 0, 0, 0 );
    textTexture.hasAlpha = true;
}

var loadLevel = function(
    name, engine, inputMap, on_loaded, on_win_callback, on_lose_callback
) {
    BABYLON.SceneLoader.Load(
        "scenes/levels/", name + ".babylon", engine,
        function (levelScene) {
            levelScene.executeWhenReady( function() {
                levelScene.activeCameras = levelScene.cameras;
                levelScene.getMeshByName( "Walls" ).getChildren().map(
                    x => x.physicsImpostor.setMass( 0 )
                );
                var shadows =
                    levelScene.lights
                        .filter( x => x.needCube !== undefined )
                        .map(
                            x => new BABYLON.ShadowGenerator( 1024, x, true)
                        );
                shadows
                    .map( x => levelScene.getMeshByName( "Walls" )
                    .getChildren()
                    .map( y => x.addShadowCaster( y ) ) );
                levelScene.meshes.map( x => x.receiveShadows = true );


                setupCar( levelScene, inputMap );
                var car_has_infiltrated_computer = setupComputer( levelScene );
                var camera_can_see_car = setupCameras( levelScene );

                setupWinLoseCriteria(
                    levelScene, car_has_infiltrated_computer,
                    camera_can_see_car,
                    on_win_callback, on_lose_callback
                );

                if(on_loaded) {
                    on_loaded(levelScene);
                }
            });
        }
    );
}

var setupCar = function( levelScene, inputMap ) {
    var headlights = levelScene.getMeshByName( "headlight" ).getChildren();
    var darklight  = levelScene.getLightByName( "DarkLight" );

    // Set up headlight toggle button
    var still_pressed = false;
    levelScene.onBeforeRenderObservable.add(()=>{
        if( ( inputMap[ "f" ] || inputMap[ "F" ] ) ) {

            if(still_pressed == false) {
                // Toggle darklight and headlight
                headlights.map( x => x.setEnabled( ! x.isEnabled() ) );
//                darklight.setEnabled( ! headlights[ 0 ].isEnabled() );
            }

            still_pressed = true;
        }
        else {
            still_pressed = false;
        }
    });

    // On startup, headlights on, darklight off
    headlights.map( x => x.setEnabled( true ) );
//    darklight.setEnabled( ! headlights[ 0 ].isEnabled() );


    // Set up car motion
    var car = levelScene.getMeshByName( "Car" );
    var originalPosition = car.position;
    var engine = levelScene.getEngine();

    if(car.rotationQuaternion == undefined) {
        car.rotationQuaternion = new BABYLON.Quaternion.RotationYawPitchRoll(
            car.rotation.y, car.rotation.x, car.rotation.z
        )
    }

    var car_rotation_matrix = new BABYLON.Matrix();
    levelScene.onBeforeRenderObservable.add(function() {
        var acceleration_coefficient            = 0.2;
        var lateral_friction_coefficient        = 0.1;
        var static_engine_friction_coefficient  = 0.005;
        var dynamic_engine_friction_coefficient = 0.001;

        var car_acceleration = 0;
        var turning_angle = 0;

        // dt in milliseconds
        var dt = Math.max(engine.getDeltaTime(), 1);

        if(inputMap["w"] || inputMap["ArrowUp"]) {
            car_acceleration = 1;
        }
        if(inputMap["a"] || inputMap["ArrowLeft"]) {
            turning_angle = -4;
        }
        if(inputMap["s"] || inputMap["ArrowDown"]) {
            car_acceleration = -1;
        }
        if(inputMap["d"] || inputMap["ArrowRight"]) {
            turning_angle = 4;
        }

        // Get a normal vector pointing in the direction the car
        // is facing
        car.rotationQuaternion.toRotationMatrix(car_rotation_matrix);

        // Fix car's pitch and yaw
        car.rotationQuaternion.x = 0;
        car.rotationQuaternion.z = 0;

        // Apply steering
        car.physicsImpostor.setAngularVelocity(
            new BABYLON.Quaternion(0, turning_angle, 0, 0)
        );


        // Update the car's velocity in the zx-plane.

        var original_velocity_3 = car.physicsImpostor.getLinearVelocity();
        var original_velocity = new BABYLON.Vector2(
            original_velocity_3.x, original_velocity_3.z
        );

        var car_direction_3 = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(0, 0, 1),
            car_rotation_matrix
        );
        var car_direction = new BABYLON.Vector2(
            car_direction_3.x, car_direction_3.z
        );

        var original_forward_velocity = car_direction.scale(
            BABYLON.Vector2.Dot(original_velocity, car_direction)
        );
        var original_lateral_velocity = original_velocity.subtract(
            original_forward_velocity
        );

        // Add the motor driving force
        var driving_force = car_direction.scale(
            car_acceleration * acceleration_coefficient
        );

        // Add lateral friction from the tyres
        var lateral_friction = original_lateral_velocity.scale(
            - lateral_friction_coefficient
        );

        // Add static engine friction
        var static_engine_friction = original_forward_velocity.scale(
            - static_engine_friction_coefficient
        );

        // Add dynamic engine friction
        var dynamic_engine_friction =
            BABYLON.Vector2.Normalize(original_forward_velocity).scale(
                - dynamic_engine_friction_coefficient
                    * original_forward_velocity.lengthSquared()
            );

        var car_velocity =
            original_forward_velocity.add(
                driving_force
                    .add(static_engine_friction)
                    .add(dynamic_engine_friction)
                    .scale(dt)
            );

        car.physicsImpostor.setLinearVelocity(
            new BABYLON.Vector3(
                car_velocity.x, original_velocity_3.y, car_velocity.y
            )
        );

    });
}

var setupMonitors = function( playerScene, levelScene ) {
    var monitors =
        [ "Left", "Center", "Right" ]
            .map( x => playerScene.getMeshByName( "Monitor." + x ) )

    for( var i=0; i<monitors.length; i++ ) {
        var camera = levelScene.cameras[ i % levelScene.cameras.length ];
        if( monitors.material === undefined ) {
            makeMonitor(
                monitors[ i ],
                playerScene, levelScene,
                levelScene.cameras[ i % levelScene.cameras.length ]
            );
        } else {
            monitors.material.diffuseTexture.dispose();
            monitors[ i ].material.diffuseTexture = makeMonitorTexture(
                levelScene, levelScene.cameras[ i % levelScene.cameras.length ]
            );
        }

        if( camera.parent === undefined || camera.parent.name != "Car" ) {
            var t = monitors[ i ].material.diffuseTexture;
            var postProcess = new BABYLON.PostProcess(
                "noise", "noise", ["screenSize", "time", "scaling"],
                null, 0.25, camera
            );
            postProcess.onApply = function (effect) {
                effect.setFloat2("screenSize", postProcess.width, postProcess.height);
                effect.setFloat("time", performance.now() + i);
                effect.setFloat("scaling", 1000.0);
            };
            t.level = 1;

            [
                postProcess,
                new BABYLON.GrainPostProcess( "grainy" + i, 1.8, camera ),
            ].map( x => t.addPostProcess( x ) );
        }
    }
}

// Setup the cameras, returning an object which says when a camera can
// see the car
var setupCameras = function( levelScene ) {

    // Get non-car cameras
    var security_cameras = levelScene.cameras.filter(
        x => !(x.parent && x.parent.name == "Car")
    );

    var camera_has_seen_the_car = Array(security_cameras.length);
    camera_has_seen_the_car = camera_has_seen_the_car.map( x => false );

    // Add car detection
    var car = levelScene.getMeshByName( "Car" );
    levelScene.onBeforeRenderObservable.add(()=>{
        for(var i = 0; i < security_cameras.length; i++) {
            var camera = security_cameras[i];

            camera_has_seen_the_car[i] = false;

            // Check the car *could* be seen by the camera
            if(camera.isInFrustum(car)) {

                // Check the car *has* been seen by the camera.
                // We check the center of the car can be seen without
                // occlusion.

                // Create a ray from the camera to the car
                var raw_ray = car.position.subtract(camera.position);
                var raw_ray_length = raw_ray.length();
                var raw_ray_normal = raw_ray.scale(1/raw_ray_length);

                var ray = new BABYLON.Ray(
                    camera.position, raw_ray_normal, raw_ray_length
                );

                // Pick the first object that intersects with the ray
                var picked = levelScene.pickWithRay(ray);

                // Check the first intersection was the car
                if(
                    picked.hit
                    && picked.pickedMesh
                    && picked.pickedMesh.name == "Car"
                ) {
                    camera_has_seen_the_car[i] = true;
                }
            }

        }
    });

    return camera_has_seen_the_car;
}

var setupComputer = function( levelScene ) {
    var computer = levelScene.getMeshByName( "Computer" );
    var car      = levelScene.getMeshByName( "Car" );

    var car_has_infiltrated_computer = [false];

    levelScene.onBeforeRenderObservable.add(()=>{
        car_has_infiltrated_computer[0] = false;

        // Check collision with the car
        if(computer.intersectsMesh(car, true)) {
            // Check the faces are touching

            // Generate a normalized ray between the centers of both bodies, and
            // check both bodies are facing along this ray.
            //
            // The dot product for a bodies normal and the ray will be high
            // when the body is facing the other body.

            var ray = new BABYLON.Vector3(
                computer.position.x - car.position.x,
                computer.position.y - car.position.y,
                computer.position.z - car.position.z
            ).normalize();

            var computer_normal = BABYLON.Vector3.TransformCoordinates(
                new BABYLON.Vector3(0, 0, 1),
                computer.getWorldMatrix().getRotationMatrix()
            );

            var car_normal = BABYLON.Vector3.TransformCoordinates(
                new BABYLON.Vector3(0, 0, 1),
                car.getWorldMatrix().getRotationMatrix()
            );

            if(
                BABYLON.Vector3.Dot(computer_normal, ray) > 0.9
                && BABYLON.Vector3.Dot(car_normal, ray) > 0.9
            ) {
                car_has_infiltrated_computer[0] = true;
            }
        }
    });

    return car_has_infiltrated_computer;
}

var setupWinLoseCriteria = function(
    levelScene, car_has_infiltrated_computer, camera_can_see_car,
    on_win_callback, on_lose_callback
) {

    var headlights = levelScene.getMeshByName( "headlight" ).getChildren();
    levelScene.onBeforeRenderObservable.add(()=>{
        // If any camera can see the car
        if(camera_can_see_car.some( x => x)) {
            // And if the headlights are on!
            if(headlights.some( x => x.isEnabled() )) {
                // Then we lose
                if(on_lose_callback) on_lose_callback();
            }
        }

        // If the car has infiltrated the computer, we've won!
        if(car_has_infiltrated_computer[0]) {
            if(on_win_callback) on_win_callback();
        }
    });
}
