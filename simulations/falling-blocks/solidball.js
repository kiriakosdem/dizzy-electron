function SolidBall(x, y, r) {
    this.options = {
		frictionAir: 0,
		frictionStatic: 0.0,
        friction: 0.1,
        restitution: 0.5,
		//density: 10000,
		//inertia: Infinity,
		//inverseInertia: 0,
		//slop: 0
    }
	this.x = x;
	this.y = y;
	this.r = r;
	this.d = 2*this.r
	
	//Create Body and Add to the World
    this.body = Matter.Bodies.circle(this.x, this.y, this.r, this.options);
	var maxspeed = 10/mytimescale;
//	Matter.Body.setVelocity(this.body, {x: random(-maxspeed,maxspeed), y: random(-maxspeed,maxspeed)});

    Matter.World.add(myworld, this.body);
	
	//Delete out-of-frame Objects
	this.isOffScreen = function(){
		var position = this.body.position;
		return (position.y > myheight || position.y<0 || position.x > mywidth || position.x < 0);		
	}
	
	this.removeFromWorld = function(){
		Matter.World.remove(myworld, this.body);
	}
	
	
	//Draw Function
    this.show = function() {
    	var position = this.body.position;
    	var angle = this.body.angle;
    	push();
    	translate(position.x, position.y);
    	rotate(angle);
    	//rectMode(CENTER);
		var vel = this.body.speed;
    	strokeWeight(1);
    	stroke(0,0,155);
		noStroke();
		var mycolorscale = 0.7*mytimescale;
    	fill(map(vel,0,mycolorscale*maxspeed,0,255),0,255-map(vel,0,mycolorscale*maxspeed,0,255),map(vel,0,mycolorscale*maxspeed,0,255));
		fill(0,0,255);
    	ellipse(0, 0, this.d);
//		strokeWeight(1);
//		stroke(0);
//		line(0,0,this.r,0);
		
		//print(this.body.velocity.x);
    	pop();
  	}

}