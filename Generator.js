var fs = require('fs');
var mysql = require('mysql');
var _ = require('underscore')
var cbCount = 0;

var days = 8;
var capacityPerSlot = 2200;
var colors = [];

var con = mysql.createConnection({
    host: 'localhost',
    user: 'root',  //Replace username and password to your username and password
    password: 'mysql',
    database: 'amrita-registration'
});

con.connect(function (err) {
    if (err) throw err;
    console.log('Connected to MYSQL!');
});

var totalBranches = [];
var totalSubs = [];
//Subject Constructor
function Subject(name, code, count, color) {
    this.name = name;
    this.code = code;
    this.count = count;
    this.color = color;
    this.adjSub = [];
    this.nonadjSub = [];
    this.branches = [];
    this.colorDomain = [];
    this.setColor = function (color) {
        var sub = this;
        this.color = color;
        this.color.filled += this.count;
        this.color.subjects.push(sub);
        this.branches.forEach(function (branch) {
            branch.setSlot(sub.color.slot);
        });
    }
}

function Branch(name) {
    this.name = name;
    this.adjBranch = [];
    this.subjects = [];
    this.setSlot = function (slot) {
        this.slot = slot;
        var branch = this;
        _.each(branch.subjects, function (subject) {
            _.each(subject.branches,function(br){
                if(!br.slot){
                    br.setSlot(branch.slot);
                }
            })
        });
    }
}

// function Color(code,day,slot,capacity){
//     this.code = code;
//     this.day = day;
//     this.slot = slot;
//     this.capacity = capacity;
//     this.filled = 0;
//     this.subjects = [];
//     this.subjectDomain = [];
//     this.updateDomain = function(coloredSub){

//     }



// }

// Sort function same as compareTo function in Java.
function sort(a, b) {
    if (a.count > b.count) {
        return -1;
    }
    if (a.count < b.count) {
        return 1;
    }
    return 0;
}

function sortOnDegree(a, b) {
    if (a.adjSub.length > b.adjSub.length) {
        return -1;
    }
    if (a.adjSub.length < b.adjSub.length) {
        return 1;
    }
    if (a.adjSub.length == b.adjSub.length) {
        var max1 = Math.max.apply(Math, a.adjSub.map(function (o) { return o.count; }));
        var max2 = Math.max.apply(Math, b.adjSub.map(function (o) { return o.count; }))
        if (max1 > max2) {
            return -1;
        }
        else {
            return 1;
        }

    }
}

function returnSubObj(code) {
    return _.find(totalSubs, function (obj) {
        return obj.code == code;
    });
}

function create_colors() {
    for (i = 1; i <= days * 2; i++) {
        day = (i % 2 == 0) ? parseInt(i / 2) : parseInt(i / 2) + 1;
        slot = (i % 2 == 0) ? 2 : 1;
        sql = "INSERT IGNORE INTO Colors (Code,Day,Slot,Capacity,Filled) VALUES('D" + day + "S" + slot + "'," + day + "," + slot + "," + capacityPerSlot + ",0)";
        colors.push({ code:"D"+day+"S"+slot, day: day, slot: slot, capacity: capacityPerSlot, filled: 0, subjects: [] });
        con.query(sql, function (err) {
            if (err) throw err
        });
    }
    colors = _.sortBy(colors, function (color) { return color.capacity });
}

function Graph() {
    var sql = "SELECT * FROM Courses WHERE 1";
    con.query(sql, function (err, result) {
        if (err) throw err;
        result.forEach(function (sub) {
            sql = "SELECT DISTINCT Branch FROM " + sub.Code + " WHERE isArrear = 0"
            cbCount++;
            con.query(sql, function (err, branch) {
                if (err) throw err;
                var obj = new Subject(sub.Name, sub.Code, sub.Students, sub.color);
                branch.forEach(function (br) {
                    var selectedBranch = _.find(totalBranches, function (branch) {
                        return branch.name == br.Branch;
                    });
                    if (selectedBranch) {
                        obj.branches.push(selectedBranch)
                        selectedBranch.subjects.push(obj);
                    }
                    else {
                        selectedBranch = new Branch(br.Branch)
                        selectedBranch.subjects.push(obj);
                        totalBranches.push(selectedBranch);
                        obj.branches.push(selectedBranch);
                    }
                });
                // for(i=0;i<obj.branches.length;i++){
                //     for(j=0;j<obj.branches.length && j!=i;j++){
                //         obj.branches[i].adjBranch.push(obj.branches[j]);
                //     }
                // }
                totalSubs.push(obj);
                cbCount--;
                if (cbCount == 0) {
                    console.log("subjects Created");
                    createGraph();
                }
            });

        });

    });
}

function createGraph() {
    var sql = "SELECT * FROM Matrix WHERE 1;"
    con.query(sql, function (err, result) {
        if (err) throw err;
        result.forEach(function (subject) {
            var sub1 = returnSubObj(subject.FromSUB);
            var sub2 = returnSubObj(subject.ToSUB);
            if (subject.Count > 0) {
                sub1.adjSub.push({ sub: sub2, count: subject.Count, arrears: subject.Arrears });
                sub2.adjSub.push({ sub: sub1, count: subject.Count, arrears: subject.Arrears });
            }
            else {
                sub1.nonadjSub.push(sub2);
                sub2.nonadjSub.push(sub1);
            }
        });
        totalSubs.sort(sortOnDegree);
        // totalSubs.forEach(function(subject){
        //     subject.adjSub.sort(sort);
        // });
        console.log("Graph Created!");
        generateTable();
    });
}

function CheckColorable(color, subject) {
    var flag = true;
    // _.each(subject.branches,function(branch){        
    //     if(branch.slot && branch.slot != color.slot){
    //         console.log("subject: "+subject.code+" b:"+branch.slot+" c: "+color.slot)            
    //          flag = false;
    //          return;
    //     }
    // });

    _.each(color.subjects, function (sub) {
        if (_.findWhere(subject.adjSub, { sub: sub })) {
            flag = false;
        }
    });

    if (((color.capacity - color.filled) >= subject.count) && flag) {
        return true;
    }
    else {
        return false;
    }
}

function generateTable() {
    totalBranches = _.sortBy(totalBranches,function(branch){
        return -branch.subjects.length;
    });
    
    var slot;
    _.each(totalBranches,function(branch){
        slot = branch.slot?branch.slot:slot==1?2:1;
        var day = 1;
        while(day<=days){
            _.each(branch.subjects,function(subject){
                var assignColor = _.find(colors,function(color){
                    return color.day == day && color.slot == slot && CheckColorable(color,subject);
                });
                if(assignColor && !subject.color){
                    subject.setColor(assignColor);
                }
            });  
            day++;  
        }
    });

    _.each(totalSubs,function(sub,index){
        if(!sub.color && sub.branches.length != 0){
            //Some problem with S3MCA students, In the CSV file S3 MCA has been marked as S5MCA thus the subjects containing these branches have some problem
            //Ignore those for now
            console.log("Subject: "+sub.code + "Has not got a color ");
        }
        
    });

    _.each(colors,function(color){
        console.log("Color:"+color.code+" capacity: "+color.capacity+" Filled: "+color.filled + ":  ");
        _.each(color.subjects,function(sub){
            console.log("Sub: "+sub.code + " count: "+sub.count);
        });
    });
    test();
}

function test(){
    var fail = 0;
    var pass = 0;
    _.each(totalBranches,function(branch){
        var slot = branch.subjects[0].color.slot;
        _.each(branch.subjects,function(sub){
            if(slot != sub.color.slot){
                console.log("Conflict with branch: "+branch.name + " actual slot: "+sub.color.slot + " branch slot: "+slot + " For: "+sub.code)
            }
        });
    });
}


//Main function
create_colors();
Graph();