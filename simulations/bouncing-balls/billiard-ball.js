let maxspeed = 5;
let balldiameter = (fullscreenheight+fullscreenwidth)/80;

class BilliardBall {

	
constructor(x, y) {
	this.diameter = random((fullscreenheight+fullscreenwidth)/30,(fullscreenheight+fullscreenwidth)/80);
	this.radius = this.diameter / 2;
	this.x = x;
	this.y = y;
	this.speedx = random(-maxspeed/Math.sqrt(2), maxspeed/Math.sqrt(2));
	this.speedy = random(-maxspeed/Math.sqrt(2), maxspeed/Math.sqrt(2));
	this.red = 255;
	this.green = 255;
	this.blue = 255;
}

	
move() {
	this.x += this.speedx;
	this.y += this.speedy;
}

	
show() {
	noStroke();
	let velocitymag = Math.sqrt(pow(this.speedx,2)+pow(this.speedy,2));
	fill(map(velocitymag,0,2*maxspeed,0,255), 0, map(velocitymag,0,2*maxspeed,255,0));
	ellipse(this.x, this.y, this.diameter, this.diameter);
	//image(poolballimag, this.x - this.radius, this.y - this.radius, this.diameter, this.diameter);
}


changeColor(bright) {
	this.red = bright;
	this.green = bright;
	this.blue = bright;
}


wallcolission() {
	//bottom wall
	if (this.y > height - this.diameter / 2) {
  		this.y = height - this.diameter / 2
  		this.speedy *= -1;
	}
	//top wall
	if (this.y < 0 + this.diameter / 2) {
  		this.y = this.diameter / 2
  		this.speedy *= -1;
	}
	//right wall
	if (this.x > width - this.diameter / 2) {
  		this.x = width - this.diameter / 2
  		this.speedx *= -1;
	}
	//left wall
	if (this.x < 0 + this.diameter / 2) {
		this.x = this.diameter / 2
  	this.speedx *= -1;
	}
}
	

pistoncolission(pistonnow) {
	let dp = dist(this.x, 0, piston.x, 0);
	if (dp <= (this.radius + piston.width/2)){
		if (this.speedx < 0){
			this.speedx *= -1;
		}
		this.speedx += 1000*piston.speedx;
		this.x = piston.x +piston.width/2 + this.radius;
	}
}
	
	
	
ballcolission(otherball) {
    // calculate distance vector
	let d = dist(this.x, this.y, otherball.x, otherball.y);
    let dx = this.x - otherball.x;
    let dy = this.y - otherball.y;
	
    if (d <= (this.radius + otherball.radius)){
		// speed on the line of colission 
		let vx1 = (dx*this.speedx+dy*this.speedy)/pow(d,2)*dx;
		let vy1 = (dx*this.speedx+dy*this.speedy)/pow(d,2)*dy;
		let vx2 = (dx*otherball.speedx+dy*otherball.speedy)/pow(d,2)*dx;
		let vy2 = (dx*otherball.speedx+dy*otherball.speedy)/pow(d,2)*dy;

		// space them out, so they don't overlap
		let exsp = (this.radius+otherball.radius)/2-d/2;
		this.x += exsp*dx/d;
		this.y += exsp*dy/d;    
		otherball.x -= exsp*dx/d;
		otherball.y -= exsp*dy/d;

		// swap speeds
		this.speedx += - vx1 + vx2;
		this.speedy += - vy1 + vy2;
		otherball.speedx += - vx2 + vx1;
		otherball.speedy += - vy2 + vy1;
  	}
	// return (d < (this.radius + otherball.radius));
}
	

gravity() {
	this.speedy += 0.10;
}

friction() {
	this.speedx *= 0.995;
	this.speedy *= 0.995;
	if ((this.speedx * this.speedx + this.speedy * this.speedy) < 1) {
  		this.speedx *= 0.99;
  		this.speedy *= 0.99;
	}
}


selected(mx, my) {
	let distance = dist(mx, my, this.x, this.y);
	return (distance < this.diameter / 2);
}


rollover(mx, my) {
	let selectedball = false;
	let distance = dist(mx, my, this.x, this.y);
	if (distance < this.diameter / 2) {
  		this.green = 0;
  		this.blue = 255;
	}else{
  		this.green = 255;
  		this.blue = 255;
	}
}

	
}