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
            var imposters = scene.getPhysicsEngine().getImpostors();
            console.log( imposters.map( x => x.mass ) );
            //imposters.filter( x => x.mass == 0.001 ).map( x => x.setMass( 0 ) );
            scene.activeCameras = scene.cameras;
            setupMonitors( newScene );
        });
    });
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

