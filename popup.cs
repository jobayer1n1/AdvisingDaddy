body {
    width: 300px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    padding: 10px;
    background-color: #f9f9f9;
}

h2, h3 {
    margin-top: 0;
    color: #333;
}

.input-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

input {
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
}

button {
    padding: 8px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
}

button:hover {
    background-color: #0056b3;
}

.danger-btn {
    background-color: #dc3545;
    margin-top: 15px;
    width: 100%;
}

.danger-btn:hover {
    background-color: #a71d2a;
}

#priorityList {
    max-height: 250px;
    overflow-y: auto;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
}

.course-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    border-bottom: 1px solid #eee;
}

.course-row:last-child {
    border-bottom: none;
}

.sections {
    color: #666;
    font-size: 0.9em;
}

.remove-btn {
    background: transparent;
    color: #999;
    padding: 2px 6px;
    font-size: 1.1em;
}

.remove-btn:hover {
    background: transparent;
    color: #ff0000;
}

.empty-state {
    padding: 15px;
    text-align: center;
    color: #999;
    font-style: italic;
}

.check {
    margin-left: 5px;
}
.pending {
    margin-left: 5px;
    opacity: 0.5;
}