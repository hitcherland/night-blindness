BABYLON.Effect.ShadersStore["noiseFragmentShader"] = `
#ifdef GL_ES
precision highp float;
#endif

// Samplers
varying vec2 vUV;
uniform sampler2D textureSampler;

// Parameters
uniform vec2 screenSize;
uniform float highlightThreshold;
uniform float time;

float random( vec2 p ) {
    vec2 K1 = vec2(
        23.14069263277926, // e^pi (Gelfond's constant)
         2.665144142690225 // 2^sqrt(2) (Gelfondâ€“Schneider constant)
    );
    return fract( cos( dot(time * p,K1) ) * 12345.6789 );
}

float highlights(vec3 color)
{
 return smoothstep(highlightThreshold, 1.0, dot(color, vec3(0.3, 0.59, 0.11)));
}

void main(void) 
{
 vec2 texelSize = vec2(1.0 / screenSize.x, 1.0 / screenSize.y);
 vec4 baseColor = texture2D(textureSampler, vUV + vec2(-1.0, -1.0) * texelSize) * 0.25;
 baseColor += texture2D(textureSampler, vUV + vec2(1.0, -1.0) * texelSize) * 0.25;
 baseColor += texture2D(textureSampler, vUV + vec2(1.0, 1.0) * texelSize) * 0.25;
 baseColor += texture2D(textureSampler, vUV + vec2(-1.0, 1.0) * texelSize) * 0.25;
    float rand = random( floor( vUV * 1000.0 ) );
    baseColor = ( 4.0 * baseColor + vec4( rand,rand,rand, 1 ) ) / 5.0;
    baseColor.a = 1.0;

 gl_FragColor = baseColor;
}`


var makeMonitorTexture = function( scene, camera ) {
    var diff = new BABYLON.RenderTargetTexture(
        ".renderTexture", 1024, scene, true
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

var makeMonitor = function( monitor, localScene, remoteScene, remoteCamera ) {
    var mat = new BABYLON.StandardMaterial(
        monitor.name + ".material", localScene
    );
    var diff = makeMonitorTexture( remoteScene, remoteCamera );
    monitor.material = mat
    mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    mat.diffuseTexture = diff;
    remoteCamera.customRenderTargets.push( mat.diffuseTexture );


}

var loadLevel = function( name ) {
    BABYLON.SceneLoader.Load(
        "scenes/levels/", name + ".babylon", engine,
        function (newScene) {
            newScene.executeWhenReady( function() {
                scene = newScene;
                scene.activeCameras = scene.cameras;
                scene.getMeshByName( "Walls" ).getChildren().map(
                    x => x.physicsImpostor.setMass( 0 )
                );
                var shadows =
                    scene.lights
                        .filter( x => x.needCube !== undefined )
                        .map(
                            x => new BABYLON.ShadowGenerator( 1024, x, true)
                        );
                shadows
                    .map( x => scene.getMeshByName( "Walls" )
                    .getChildren()
                    .map( y => x.addShadowCaster( y ) ) );
                scene.meshes.map( x => x.receiveShadows = true );

                setupCar( newScene );
                setupMonitors( newScene );
                setupComputer( newScene );
            });
        }
    );
}

var setupCar = function( scene ) {
    var headlights = scene.getMeshByName( "headlight" ).getChildren();
    var darklight  = scene.getLightByName( "DarkLight" );

    // Set up headlight toggle button
    var still_pressed = false;
    scene.onBeforeRenderObservable.add(()=>{
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

    var car = scene.getMeshByName( "Car" );
    car_control( car, scene );
}

var setupMonitors = function( scene ) {
    var monitors =
        [ "Left", "Center", "Right" ]
            .map( x => playerScene.getMeshByName( "Monitor." + x ) )
    for( var i=0; i<monitors.length; i++ ) {
        var camera = scene.cameras[ i % scene.cameras.length ];
        if( monitors.material === undefined ) {
            makeMonitor(
                monitors[ i ],
                playerScene, scene,
                scene.cameras[ i % scene.cameras.length ]
            );
        } else {
            delete monitors.material.diffuseTexture;
            monitors[ i ].material.diffuseTexture = makeMonitorTexture(
                scene, scene.cameras[ i % scene.cameras.length ]
            );
        }

        if( camera.parent === undefined || camera.parent.name != "Car" ) {
            var t = monitors[ i ].material.diffuseTexture;
            var postProcess = new BABYLON.PostProcess("noise", "noise", ["screenSize", "highlightThreshold", "time"], null, 0.25, camera);
            postProcess.onApply = function (effect) {
                effect.setFloat2("screenSize", postProcess.width, postProcess.height);
                effect.setFloat("highlightThreshold", 0.90);
                effect.setFloat("time", performance.now() + i);
            };
            t.level = 1;

            [
                postProcess,
                new BABYLON.GrainPostProcess( "grainy" + i, 1.8, camera ),
            ].map( x => t.addPostProcess( x ) );

        }
    }

    // Get non-car cameras
    var security_cameras = scene.cameras.filter(
        x => !(x.parent && x.parent.name == "Car")
    );

    // An object showing which camera can see the car
    var camera_has_seen_the_car = Array(security_cameras.length);
    camera_has_seen_the_car = camera_has_seen_the_car.map( x => false );

    // Add car detection
    var car = scene.getMeshByName( "Car" );
    scene.onBeforeRenderObservable.add(()=>{
        for(var i = 0; i < security_cameras.length; i++) {
            var camera = security_cameras[i];

            var old_seen_on_camera = camera_has_seen_the_car[i];

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
                var picked = scene.pickWithRay(ray);

                // Check the first intersection was the car
                if(
                    picked.hit
                    && picked.pickedMesh
                    && picked.pickedMesh.name == "Car"
                ) {
                    camera_has_seen_the_car[i] = true;

                    //console.log(i, "Seen on camera", i);
                }
            }

            if(camera_has_seen_the_car[i] != old_seen_on_camera) {
                if(camera_has_seen_the_car[i]) {
                    console.log("Car is visible on camera %d", i);
                }
                else {
                    console.log("Car not visible on camera %d", i);
                }
            }

        }
    });
}

var setupComputer = function( scene ) {
    var computer = scene.getMeshByName( "Computer" );
    var car      = scene.getMeshByName( "Car" );

    scene.onBeforeRenderObservable.add(()=>{
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
                console.log("Success!");
            }
        }
    });
}
