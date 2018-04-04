var fs = require('fs');
var mysql = require('mysql');
var csv = require('fast-csv');
var cwd = 'Students_List'; //CSV FOLDER
var _ = require('underscore')
var cbCount = 0; //Used to Check IF all Callbacks( Async process are finished)
var totsubs = [];

var con = mysql.createConnection({
    host: 'localhost',
    user: 'root',  //Replace username and password to your username and password
    password: 'mysql',
    database: 'amrita-registration',
    multipleStatements: true
});

con.connect(function (err) {
    if (err) throw err;
    console.log('Connected to Mysql!');
    init()
})


function createStudentTable() { //Function To Store all Students Details.
    sql = "SELECT Code FROM Courses WHERE 1"
    con.query(sql, function (err, result) {
        if (err) throw err;
        sql = ""
        result.forEach(function (sub) {
            sql += "INSERT INTO Students (Name,rollNo,Branch,Arrears,Count) SELECT Name,rollNo,Branch,isArrear,0 FROM `" + sub.Code + "` WHERE 1 ON DUPLICATE KEY UPDATE Count = Count + 1 , Arrears = Arrears + isArrear;"

        });
        console.log("Inserting Students to Student table...")
        con.query(sql, function (err, result) {
            if (err) throw err;
            console.log("Inserted Student into Students Table ");

            console.log("Done");
            process.exit(0);
        });
    })
}

function createRead(csvFile) {
    query = ""
    query2 = ""




}

function init() { //Function to Read ALL CSV
    var Students = fs.readdirSync(cwd);

    var sql = "CREATE TABLE IF NOT EXISTS Courses (Name varchar(255),Code varchar(255),Students INT,PRIMARY KEY(Code));"
    sql += "CREATE TABLE IF NOT EXISTS Matrix (ID int NOT NULL AUTO_INCREMENT,FromSUB varchar(255),ToSUB varchar(255),Count int NOT NULL,Arrears int NOT NULL,PRIMARY KEY(ID));"
    sql += "CREATE TABLE IF NOT EXISTS Students (Name varchar(255),rollNo varchar(255),Branch varchar(255),Arrears int NOT NULL,Count int NOT NULL,PRIMARY KEY(rollNo));"
    con.query(sql, function (err) {
        if (err) throw err;
        console.log("Done initialize table..");
    });
    query = ""
    query2 = ""
    Students.forEach(function (student) {
        var folder = cwd + '/' + student;
        if (fs.statSync(folder).isDirectory()) {
            var files = fs.readdirSync(folder);
            
            files.forEach(function (file,index) {
                cbCount++;
                fs.createReadStream(folder + '/' + file).pipe(csv())
                    .on('data', function (data) {
                        let subcode;
                        if (data[4] != '') {
                            /*  formatting for Inconsistent format Of In the Spreadsheet All Hardcoded no need to bother
                                eg: Some places subjects code terminate with -
                                    Some places subjects code terminate with .
                                    Some places /
                            */
                            if (data.length > 5) {
                                data.shift();

                            }
                            data[4] = data[4].trim();

                            if (data[4].indexOf('.') != -1) {
                                subcode = data[4].substring(0, data[4].indexOf('.'));
                            }
                            else if (data[4].indexOf('/') != -1) {
                                subcode = data[4].substring(0, Math.min(data[4].indexOf(' '), data[4].indexOf('/')));
                            }
                            else if (data[4].indexOf('-') != -1) {
                                subcode = data[4].substring(0, Math.min(data[4].indexOf(' '), data[4].indexOf('-')));
                            }
                            else {
                                subcode = data[4].substring(0, data[4].indexOf(' '));
                            }
                            // Relevant Code
                            // Add Courses to Course List
                            query += "INSERT INTO Courses (Name,Code,Students) VALUES('" + data[4] + "','" + subcode + "', 1) ON DUPLICATE KEY UPDATE Students = Students+1;"
                            //CREATE Table with name of SubjectCode
                            var course = _.find(totsubs, function (sub) {
                                return sub == subcode;
                            });
                            if (!course) {
                                query += "CREATE TABLE IF NOT EXISTS " + subcode + " (ID int NOT NULL AUTO_INCREMENT,Branch varchar(255),rollNo varchar(255),name varchar(255),course varchar(255),isArrear boolean,PRIMARY KEY(ID),UNIQUE(rollNo));"
                            }
                            isArrear = false;
                            indexToCheck = 0;
                            sem = data[0].split(' ')[0];
                            subject = data[0].split(' ')[1];
                            if (subject != 'BCA') {
                                year = data[2].charAt(data[2].length - 4);
                            }
                            else {
                                year = data[2].charAt(data[2].length - 7);
                            }
                            if ((sem == 'S1' && year != '7') || (sem == 'S3' && year != '6') || (sem == 'S5' && year != '5') || (sem == 'S7' && year != '4')) {
                                isArrear = true;
                            }
                            query2 += "INSERT IGNORE INTO " + subcode + " (Branch,rollNo,name,course,isArrear) VALUES('" + data[0] + "','" + data[2] + "','" + data[3] + "','" + data[4] + "'," + isArrear + ");";


                        }
                    })
                    .on('end', function (end) {
                        console.log('Finshed reading ' + file + '.....');
                        cbCount--;
                        if(cbCount == 0){
                           console.log("Creating and inserting students in student table..");
                           saveStudents(query,query2);
                        }
                        return;
                    });

            });

           
            
        }

    });
    


}

function saveStudents(query,query2){
    con.query(query,function(err){
        if(err) throw err;
        console.log("Finished creating tables...");
    });
    con.query(query2,function(err){
        if(err) throw err;
        console.log("Finished inserting students...");
        console.log("Creating student matrix..");
        findCommon();
    });
}

function InsertMatrix(sql) {
    console.log("Inserting above list in matrix database..")
    con.query(sql, function (err) {
        if (err) throw err;
        console.log('Successfully added into Matrix Table..')
        createStudentTable();

    });
}

function findCommon() {
    console.log("Finding common.."); //Function to Find no of common students between Subjects
    var query = "SELECT Code FROM Courses;"
    con.query(query, function (err, result) {
        if (err) throw err;
        result = JSON.stringify(result);
        result = JSON.parse(result);
        sql1 = "";
        for (var i = 0; i < result.length - 1; i++) {
            let sub1 = result[i].Code;
            for (var j = i + 1; j < result.length; j++) {
                let sub2 = result[j].Code;
                var sql = "SELECT Count(`" + sub1 + "`.rollNo) as count1 FROM `" + sub1 + "` INNER JOIN `" + sub2 + "` ON `" + sub1 + "`.rollNo = `" + sub2 + "`.rollNo WHERE `" + sub1 + "`.isArrear = 0 AND `" + sub2 + "`.isArrear = 0"
                var sql2 = "SELECT Count(`" + sub1 + "`.rollNo) as count2 FROM `" + sub1 + "` INNER JOIN `" + sub2 + "` ON `" + sub1 + "`.rollNo = `" + sub2 + "`.rollNo WHERE `" + sub1 + "`.isArrear = 1 OR `" + sub2 + "`.isArrear = 1"
                var sql3 = "SELECT T1.count1 , T2.count2 FROM (" + sql + ") AS T1 INNER JOIN (" + sql2 + ") AS T2 ON 1;"

                cbCount++;
                con.query(sql3, function (err, result) {
                    // result = JSON.stringify(result);
                    // result = JSON.parse(result);
                    if (err) throw err;
                    cbCount--;
                    var arrears = result[0].count2
                    var students = result[0].count1
                    sqll += "INSERT INTO Matrix (FromSUB,ToSUB,Count,Arrears) VALUES('" + sub1 + "','" + sub2 + "'," + students + "," + arrears + ");"
                    console.log(sub1 + '-' + sub2 + '=' + students + "(" + arrears + ")");
                    if (cbCount == 0) {
                        InsertMatrix(sql1);
                    }
                });
            }
        }
    })
}


