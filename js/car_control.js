function car_control(car, scene) {
    var engine = scene.getEngine();

    // Keyboard events
    var inputMap = {};
    scene.actionManager = new BABYLON.ActionManager(scene);
    scene.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
            BABYLON.ActionManager.OnKeyDownTrigger,
            function (evt) {
                inputMap[evt.sourceEvent.key] =
                    evt.sourceEvent.type == "keydown";
            }
        )
    );
    scene.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
            BABYLON.ActionManager.OnKeyUpTrigger,
            function (evt) {
                inputMap[evt.sourceEvent.key] =
                    evt.sourceEvent.type == "keydown";
            }
        )
    );


    // Game/Render loop
    if(car.rotationQuaternion == undefined) {
        car.rotationQuaternion = new BABYLON.Quaternion.RotationYawPitchRoll(
            car.rotation.y, car.rotation.x, car.rotation.z
        )
    }
    var car_rotation_matrix = new BABYLON.Matrix();
    var car_max_speed = 10;
    scene.onBeforeRenderObservable.add(function() {
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
