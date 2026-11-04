function SolidBox(x, y, w, h) {
    this.options = {
		frictionAir: 0,
		frictionStatic: 0.2,
        friction: 0.3,
        restitution: 0.1,
		//density: 1000,
		//inertia: Infinity,
		//inverseInertia: 0,
		//slop: 0
    }
	this.x = x;
	this.y = y;
	this.width = w;
    this.height = h;
	
	//Create Body and Add to the World
    this.body = Matter.Bodies.rectangle(this.x, this.y, this.width, this.height, this.options);

    Matter.World.add(myworld, this.body);
	
	//Draw Function
    this.show = function() {
//		Matter.Body.setPosition(this.body, {x: (mywidth-200)+50*Math.sin(mytimescale*idraw/15), y: this.body.position.y});
//		Matter.Body.setVelocity(this.body, {x: +mytimescale*50/15*Math.cos(mytimescale*idraw/15), y: this.body.velocity.y});

		//print(idraw, this.body.position.y);
    	var position = this.body.position;
    	var angle = this.body.angle;
    	push();
    	translate(position.x, position.y);
    	rotate(angle);
    	rectMode(CENTER);
    	strokeWeight(1);
    	stroke(255);
    	fill(127);
    	rect(0, 0, this.width, this.height);
    	pop();
  	}

}