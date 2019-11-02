function StaticBoundary(x, y, width, height, a) {
    this.options = {
		frictionAir: 0,
		frictionStatic: 0.0,
        friction: 0.1,
        restitution: 0.1,
		//density: 1000,
		angle: a,
		isStatic: true,
		inertia: Infinity,
		inverseInertia: 0,
		//slop: 0
    }
	this.x = x;
	this.y = y;
	this.width = width;
    this.height = height;
	
	//Create Body and Add to the World
    this.body = Matter.Bodies.rectangle(this.x, this.y, this.width, this.height, this.options);
	this.body.setStatic;
    Matter.World.add(myworld, this.body);
	
	//Draw Function
    this.show = function() {
    	var position = this.body.position;
    	var angle = this.body.angle;
    	push();
    	translate(position.x, position.y);
    	rotate(angle);	
    	noStroke();
    	fill(102,51,0);
		rectMode(CENTER);
    	rect(0, 0, this.width, this.height);
    	pop();
  	}

}