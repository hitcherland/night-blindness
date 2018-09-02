var makeMonitorTexture = function( scene, camera ) {
    var diff = new BABYLON.RenderTargetTexture( ".renderTexture", 1024, scene, true );
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
    var mat = new BABYLON.StandardMaterial( monitor.name + ".material", localScene );
    var diff = makeMonitorTexture( remoteScene, remoteCamera );
    monitor.material = mat
    mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    mat.diffuseTexture = diff;
    remoteCamera.customRenderTargets.push( mat.diffuseTexture );
}

var MakePhysics = function( mesh, mass ) {
    return new BABYLON.PhysicsImpostor(
            mesh,
            BABYLON.PhysicsImpostor.BoxImpostor,
            { "mass": mass, restitution: 0.9 },
            scene
        );
}

var loadLevel = function( name ) {
    BABYLON.SceneLoader.Load("scenes/levels/", name + ".babylon", engine, function (newScene) {
        newScene.executeWhenReady( function() {
            scene = newScene;
            scene.activeCameras = scene.cameras;
            scene.getMeshByName( "Walls" ).getChildren().map( x => x.physicsImpostor.setMass( 0 ) );

            setupCar( newScene );
            setupMonitors( newScene );
            setupComputer( newScene );
        });
    });
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
                darklight.setEnabled( ! headlights[ 0 ].isEnabled() );
            }

            still_pressed = true;
        }
        else {
            still_pressed = false;
        }
    });

    // On startup, headlights on, darklight off
    headlights.map( x => x.setEnabled( true ) );
    darklight.setEnabled( ! headlights[ 0 ].isEnabled() );

    var car = scene.getMeshByName( "Car" );
    car_control( car, scene );
}

var setupMonitors = function( scene ) {
    var monitors = [ "Left", "Center", "Right" ].map( x => playerScene.getMeshByName( "Monitor." + x ) )
    for( var i=0; i<monitors.length; i++ ) {
        if( monitors.material === undefined ) {
            makeMonitor( monitors[ i ], playerScene, scene, scene.cameras[ i % scene.cameras.length ] );
        } else {
            delete monitors.material.diffuseTexture;
            monitors[ i ].material.diffuseTexture = makeMonitorTexture( scene, scene.cameras[ i % scene.cameras.length ] );
        }
    }
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
