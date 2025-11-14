package com.torchat

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.torchat.ui.screens.ChatListScreen
import com.torchat.ui.screens.ChatRoomScreen
import com.torchat.ui.screens.LoginScreen
import com.torchat.ui.theme.TorChatTheme
import com.torchat.viewmodel.AuthViewModel
import com.torchat.viewmodel.ChatViewModel

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        // Install splash screen
        installSplashScreen()

        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            TorChatTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    TorChatApp()
                }
            }
        }
    }
}

@Composable
fun TorChatApp() {
    val app = (androidx.compose.ui.platform.LocalContext.current.applicationContext as TorChatApplication)

    // Create ViewModels with dependencies
    val authViewModel: AuthViewModel = viewModel(
        factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return AuthViewModel(app.torManager, app.chatRepository) as T
            }
        }
    )

    val chatViewModel: ChatViewModel = viewModel(
        factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return ChatViewModel(app.chatRepository, app.socketManager) as T
            }
        }
    )

    val navController = rememberNavController()
    val isAuthenticated by authViewModel.isAuthenticated.collectAsState()

    // Connect socket when authenticated
    LaunchedEffect(isAuthenticated) {
        if (isAuthenticated) {
            chatViewModel.connectSocket()
        }
    }

    NavHost(
        navController = navController,
        startDestination = if (isAuthenticated) "chat_list" else "login"
    ) {
        composable("login") {
            LoginScreen(
                viewModel = authViewModel,
                onLoginSuccess = {
                    navController.navigate("chat_list") {
                        popUpTo("login") { inclusive = true }
                    }
                }
            )
        }

        composable("chat_list") {
            ChatListScreen(
                authViewModel = authViewModel,
                chatViewModel = chatViewModel,
                onRoomClick = { room ->
                    navController.navigate("chat_room/${room.id}/${room.name}")
                }
            )
        }

        composable(
            route = "chat_room/{roomId}/{roomName}",
            arguments = listOf(
                navArgument("roomId") { type = NavType.StringType },
                navArgument("roomName") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val roomId = backStackEntry.arguments?.getString("roomId") ?: return@composable
            val roomName = backStackEntry.arguments?.getString("roomName") ?: "Chat"
            val currentUser by authViewModel.currentUser.collectAsState()

            ChatRoomScreen(
                roomId = roomId,
                roomName = roomName,
                currentUserId = currentUser?.id ?: "",
                viewModel = chatViewModel,
                onBackPress = {
                    navController.popBackStack()
                }
            )
        }
    }

    // Navigate to login when user logs out
    if (!isAuthenticated && navController.currentBackStackEntry?.destination?.route != "login") {
        navController.navigate("login") {
            popUpTo(0) { inclusive = true }
        }
    }
}
