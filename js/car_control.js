function car_control(car, scene) {
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
        var scaling = 1;

        var car_acceleration = 0;
        var turning_angle = 0;

        if(inputMap["w"] || inputMap["ArrowUp"]){
            car_acceleration = 1;
        }
        if(inputMap["a"] || inputMap["ArrowLeft"]){
            turning_angle = -4;
        }
        if(inputMap["s"] || inputMap["ArrowDown"]){
            car_acceleration = -1;
        }
        if(inputMap["d"] || inputMap["ArrowRight"]){
            turning_angle = 4;
        }

        // Fix car's pitch and yaw
        car.rotationQuaternion.x = 0;
        car.rotationQuaternion.z = 0;

        // Apply steering
        car.physicsImpostor.setAngularVelocity(
            new BABYLON.Quaternion(0, turning_angle, 0, 0)
        );


        // Update the car's velocity.

        // Get a normal vector pointing in the direction the car
        // is facing
        car.rotationQuaternion.toRotationMatrix(car_rotation_matrix);

        var car_direction = BABYLON.Vector3.TransformCoordinates(
            new BABYLON.Vector3(1, 0, 0),
            car_rotation_matrix
        );

        // Update the car's velocity, accelerating it in the direction
        // it's facing
        var new_velocity = car.physicsImpostor.getLinearVelocity().add(
            car_direction.scale(
                car_acceleration * scaling
            )
        );
        // Project the updated velocity onto car_direction to remove
        // drift
        var projected_velocity = car_direction.scale(
            BABYLON.Vector3.Dot(new_velocity, car_direction)
        );
        new_velocity = new BABYLON.Vector3(
            projected_velocity.x, new_velocity.y, projected_velocity.z
        );


        // Apply friction and speed limitations

        // If the car is going too fast, slow it down
        if(
            car.physicsImpostor.getLinearVelocity().lengthSquared()
            > car_max_speed*car_max_speed
        ) {
            // Scale the velocity down as a fraction of
            // max_speed / current_speed
            scaled_velocity = new_velocity.scale(
                car_max_speed*car_max_speed
                     / car.physicsImpostor.getLinearVelocity().lengthSquared()
            )

            new_velocity = new BABYLON.Vector3(
                scaled_velocity.x, new_velocity.y, scaled_velocity.z
            );
        }

        // If the user isn't accelerating, or the car is going
        // backwards, apply friction
        if(
            BABYLON.Vector3.Dot(new_velocity, car_direction)*car_acceleration
                < 0.0001
        ) {
            scaled_velocity = new_velocity.scale(0.85);
            new_velocity = new BABYLON.Vector3(
                scaled_velocity.x, new_velocity.y, scaled_velocity.z
            );
        }

        // Set the car's new velocity
        car.physicsImpostor.setLinearVelocity(new_velocity);

    });
}
