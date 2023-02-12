const Todo = require('../models/Todo');
const Project = require('../models/Project');
const mongoose = require('mongoose');
const expireTime = require('../config/anonymousDataExpireTime');

/**
 * @description Get all todos from a user
 * @route GET /api/v1/todos
 * @access Private
 */

const getAllTodos = async (req, res) => {
    const { uid, isNewUser } = req.user;

    const todos = await Todo.find({ uid: uid });
    // console.log('🚀 ~ file: todosController.js:17 ~ getAllTodos ~ todos', todos);

    if (!todos?.length) {
        console.log('in todosController: No todo found');
        return res.status(204).json({ msg: `No todos found with uid ${uid}` });
    }
    res.status(200).json(todos);
};

/**
 * @description Create new todos
 * @route POST /api/v1/todos
 * @access Private
 */
const createNewTodo = async (req, res) => {
    const { isAnonymous, uid } = req.user; // Injected from middleware verifyToken
    const { title, dueDate, projectId, priority } = req.body;

    if (!title.trim()) {
        return res.status(400).json({ msg: `No todo title` });
    }

    let newTodo = await Todo.create({
        uid,
        title,
        dueDate,
        projectId,
        priority,
        expireAt: isAnonymous ? expireTime() : null,
    });

    if (projectId) {
        await Project.updateOne({ _id: projectId }, { $addToSet: { todoList: newTodo._id } });
    }

    if (newTodo) {
        return res.status(201).json({ msg: 'New todo has been created' });
    } else {
        return res.status(400).json({ msg: 'Invalid todo data' });
    }
};

/**
 * @description Update todos
 * @route PATCH /api/v1/todos
 * @access Private
 */

const updateTodo = async (req, res) => {
    const { _id: todoId, title, completed, projectId, dueDate, description, priority } = req.body;

    if (!title) {
        return res.status(400).json({ msg: `No todo title` });
    }

    // findById(): Finds a single document by its _id field
    const todo = await Todo.findById(todoId).exec();

    if (!todo) {
        return res.status(400).json({ message: 'Todo not found' });
    }

    if (projectId && todo.projectId !== projectId) {
        await Project.updateOne({ _id: projectId }, { $addToSet: { todoList: todo._id } });
        todo.projectId = projectId;
    }

    todo.title = title;
    todo.completed = completed;
    todo.projectId = projectId;
    todo.dueDate = dueDate;
    todo.description = description;
    todo.priority = priority;
    const updatedTodo = await todo.save();

    return res.status(200).json({ msg: `Todo updated. id: ${updatedTodo._id}` });
    // return res.status(200).json({ msg: `Todo updated` });
};

/**
 * @description Delete todos
 * @route DELETE /api/v1/todos
 * @access Private
 */

const deleteTodo = async (req, res) => {
    const { _id: todoId } = req.body;
    // console.log('🚀 ~ file: todosController.js:72 ~ deleteTodo ~ req.body', req.body);

    if (!todoId) {
        return res.status(400).json({ msg: 'TodoId required' });
    }
    const todo = await Todo.findById(todoId).exec();
    if (!todo) {
        return res.status(400).json({ msg: 'Todo not found' });
    }

    if (todo.projectId) {
        // Remove todo reference in project's todoList
        const project = await Project.findById(todo.projectId).exec();
        const updatedProjectTodoList = project?.todoList.filter((todoId) => {
            if (!todoId.equals(todo._id)) return todoId;
        });
        await Project.updateOne({ _id: todo.projectId }, { $set: { todoList: updatedProjectTodoList } });
    }

    const result = await todo.deleteOne();
    res.json({ msg: `Todo with ID ${result._id} has been deleted` });
};

module.exports = {
    createNewTodo,
    getAllTodos,
    updateTodo,
    deleteTodo,
};
